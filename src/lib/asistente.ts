import { guardarCotizacionPdf } from './pdf'
/**
 * Motor del asistente de Kineta Flow.
 *
 * El asistente NO responde preguntas abiertas: solo puede actuar a través de tres
 * herramientas acotadas al proceso comercial del negocio (en línea con la política
 * de WhatsApp Business de 2026, que prohíbe asistentes de propósito general):
 *   1. consultarCatalogo  -> busca el servicio en el catálogo ACTIVO
 *   2. generarCotizacion  -> crea la cotización (la base de datos rechaza servicios sin tarifa)
 *   3. solicitarAsesor    -> pasa la conversación a una persona con un resumen
 *
 * La intención del mensaje la interpreta Claude (función en la nube «interpretar-mensaje»),
 * que solo puede elegir una herramienta y sus parámetros. El código valida esa decisión
 * contra el catálogo y escribe él mismo los precios: el modelo nunca redacta una cifra.
 * Dos reglas del dueño se aplican antes que el modelo (pedir un asesor y los casos delicados),
 * y si Claude no está disponible o su decisión no es válida, responde el motor de reglas.
 */
import { supabase } from './supabase'
import { normalizar, pesos } from './formato'
import type { Configuracion, Conversacion, Mensaje, Servicio } from './tipos'

interface Contexto {
  negocioId: string
  negocioNombre: string
  config: Configuracion
  conversacion: Conversacion
  servicios: Servicio[]
  catalogoId: string | null
  historial: Mensaje[]
  cliente: { nombre: string; municipio: string | null; datos_contexto: Record<string, unknown> }
  /** quién interpretó el mensaje: el modelo de lenguaje o el motor de reglas (se guarda en cada respuesta) */
  motor: 'claude' | 'reglas'
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'por', 'con', 'mi', 'me', 'que', 'en', 'y', 'o', 'a',
  'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'cuanto', 'cuesta', 'vale', 'valor', 'precio', 'tienen', 'quiero', 'quisiera',
  'necesito', 'informacion', 'favor', 'monitoria', 'monitorias', 'servicio', 'hijo', 'hija', 'es', 'su', 'sus', 'del', 'al', 'como', 'hay'])

const NIVELES: Record<string, string[]> = {
  universidad: ['universidad', 'universitario', 'universitaria', 'semestre', 'u', 'carrera', 'ingenieria'],
  colegio: ['colegio', 'bachillerato', 'grado', 'once', 'decimo', 'noveno', 'secundaria'],
  primaria: ['primaria', 'escuela'],
  adultos: ['adulto', 'adultos', 'trabajo'],
  residencial: ['casa', 'hogar', 'vivienda', 'apartamento', 'residencial'],
  comercial: ['negocio', 'comercio', 'local', 'empresa', 'comercial'],
  rural: ['finca', 'rural', 'campo', 'vereda'],
}

/** Herramienta 1: consultar el catálogo activo */
export function consultarCatalogo(texto: string, servicios: Servicio[]): Servicio | null {
  const t = normalizar(texto)
  const palabras = t.split(' ').filter((p) => (p.length > 1 || /\d/.test(p)) && !PALABRAS_VACIAS.has(p))
  if (!palabras.length) return null
  let mejor: Servicio | null = null
  let mejorPuntaje = 0
  for (const s of servicios) {
    const base = normalizar(`${s.nombre} ${s.palabras_clave ?? ''} ${s.categoria ?? ''}`)
    const tokens = new Set(base.split(' '))
    let puntaje = 0
    for (const p of palabras) {
      if (tokens.has(p)) puntaje += 3
      else if (p.length > 3 && [...tokens].some((tk) => tk.startsWith(p.slice(0, 5)))) puntaje += 1.5
    }
    if (puntaje === 0) continue
    const nivel = normalizar(s.nivel ?? '')
    if (nivel && NIVELES[nivel]?.some((n) => palabras.includes(n))) puntaje += 2.5
    // preferir el nombre más específico cuando empatan
    puntaje -= base.split(' ').length * 0.01
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = s }
  }
  return mejorPuntaje >= 2.9 ? mejor : null
}

function extraerCantidad(texto: string): number | null {
  const t = normalizar(texto)
  const conUnidad = t.match(/(\d+)\s*(horas?|h|hrs?|unidades?|sistemas?|paneles?|puntos?|clases?|sesiones?)\b/)
  if (conUnidad) return Math.min(200, parseInt(conUnidad[1], 10))
  // un número suelto ("serían 10") cuenta como cantidad solo en mensajes cortos y si no es una potencia (5 kWp)
  const suelto = t.match(/(\d+)(?!\s*(kwp|kw|kwh|w)\b)/)
  if (suelto && t.split(' ').length <= 4) return Math.min(200, parseInt(suelto[1], 10))
  const palabras: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, ocho: 8, diez: 10, doce: 12, quince: 15, veinte: 20 }
  for (const [p, n] of Object.entries(palabras)) if (new RegExp(`\\b${p}\\s+(horas?|clases?|sesiones?)`).test(t)) return n
  return null
}

const coincide = (t: string, re: RegExp) => re.test(normalizar(t))

async function cargarContexto(conversacionId: string): Promise<Contexto> {
  const { data: conv } = await supabase.from('conversaciones').select('*, clientes(nombre, municipio, datos_contexto)').eq('id', conversacionId).single()
  const c = conv as Conversacion & { clientes: Contexto['cliente'] }
  const [{ data: config }, { data: neg }, { data: cat }, { data: hist }] = await Promise.all([
    supabase.from('configuracion_asistente').select('*').eq('negocio_id', c.negocio_id).single(),
    supabase.from('negocios').select('nombre').eq('id', c.negocio_id).single(),
    supabase.from('catalogos').select('id').eq('negocio_id', c.negocio_id).eq('estado', 'activo').maybeSingle(),
    supabase.from('mensajes').select('*').eq('conversacion_id', conversacionId).order('creado_en'),
  ])
  let servicios: Servicio[] = []
  if (cat) {
    const { data } = await supabase.from('servicios').select('*').eq('catalogo_id', cat.id)
    servicios = (data ?? []) as Servicio[]
  }
  return {
    negocioId: c.negocio_id, negocioNombre: neg?.nombre ?? '', config: config as Configuracion, conversacion: c,
    servicios, catalogoId: cat?.id ?? null, historial: (hist ?? []) as Mensaje[], cliente: c.clientes, motor: 'reglas',
  }
}

async function responder(ctx: Contexto, contenido: string, adjunto: Mensaje['adjunto'] = null) {
  await supabase.from('mensajes').insert({ conversacion_id: ctx.conversacion.id, negocio_id: ctx.negocioId, emisor: 'ia', contenido, adjunto, motor: ctx.motor })
  await supabase.from('conversaciones').update({ ultimo_mensaje_en: new Date().toISOString() }).eq('id', ctx.conversacion.id)
}

/** Herramienta 2: generar la cotización formal */
export async function generarCotizacion(ctx: Contexto, servicio: Servicio, cantidad: number) {
  const subtotal = Number(servicio.tarifa) * cantidad
  const { minimo, porcentaje } = ctx.config.descuento_paquete
  const descuento = cantidad >= minimo ? Math.round((subtotal * porcentaje) / 100) : 0
  const vence = new Date(Date.now() + ctx.config.vigencia_cotizacion_dias * 86400000).toISOString().slice(0, 10)
  const { data: cot, error } = await supabase.from('cotizaciones').insert({
    negocio_id: ctx.negocioId, conversacion_id: ctx.conversacion.id, catalogo_id: ctx.catalogoId,
    subtotal, descuento, total: subtotal - descuento, valida_hasta: vence,
  }).select().single()
  if (error || !cot) throw error
  const descripcion = servicio.nombre + (servicio.nivel ? ` – ${servicio.nivel}` : '')
  const { error: e2 } = await supabase.from('items_cotizacion').insert({
    cotizacion_id: cot.id, servicio_id: servicio.id, descripcion, cantidad, valor_unitario: servicio.tarifa, valor_total: subtotal,
  })
  if (e2) { await supabase.from('cotizaciones').delete().eq('id', cot.id); throw e2 }
  // el PDF queda guardado en Supabase Storage; si falla, se genera al abrirlo
  guardarCotizacionPdf(cot.id).catch(() => {})
  const unidad = servicio.unidad === 'hora' ? (cantidad === 1 ? 'hora' : 'horas') : (cantidad === 1 ? servicio.unidad : servicio.unidad + 's')
  const textoDescuento = descuento > 0 ? ` con ${porcentaje} % de descuento por paquete` : ''
  await responder(ctx, `Listo. Te envío la cotización formal de ${cantidad} ${unidad} de ${descripcion}${textoDescuento}: total ${pesos(subtotal - descuento)}. Es válida por ${ctx.config.vigencia_cotizacion_dias} días.`,
    { tipo: 'cotizacion', cotizacion_id: cot.id })
  const nuevoEstado = ctx.conversacion.estado_lead === 'listo_para_comprar' ? 'listo_para_comprar' : 'cotizado'
  await supabase.from('conversaciones').update({
    estado_lead: nuevoEstado, necesidad: `${descripcion} (${cantidad} ${unidad})`, valor_potencial: subtotal - descuento,
  }).eq('id', ctx.conversacion.id)
  await esperar(500)
  const accion = ctx.servicios.some((s) => s.unidad === 'hora') ? 'Agendar monitoría' : 'Agendar visita'
  await responder(ctx, '¿Quieres dar el siguiente paso o prefieres hablar con un asesor?', { tipo: 'botones', opciones: [accion, 'Hablar con asesor'] })
}

function formatearDatos(d: Record<string, unknown>, municipio: string | null) {
  const etiquetas: Record<string, string> = {
    consumo_kwh_mes: 'Consumo', tipo_techo: 'Techo', direccion: 'Dirección', factura_energia: 'Factura', estudiante: 'Estudiante',
  }
  const partes = Object.entries(d).map(([k, v]) => `${etiquetas[k] ?? k}: ${v}${k === 'consumo_kwh_mes' ? ' kWh/mes' : ''}`)
  if (municipio) partes.push(`Municipio: ${municipio}`)
  return partes.join(' · ') || 'Sin datos adicionales registrados.'
}

/** Herramienta 3: pasar la conversación a una persona, con un resumen para el asesor */
export async function solicitarAsesor(ctx: Contexto, motivo: string, mensajeCliente: string) {
  const { data: ultCot } = await supabase.from('cotizaciones').select('numero,total').eq('conversacion_id', ctx.conversacion.id)
    .order('creada_en', { ascending: false }).limit(1).maybeSingle()
  const mensajesCliente = ctx.historial.filter((m) => m.emisor === 'cliente').map((m) => m.contenido)
  const resumen = {
    necesidad: ctx.conversacion.necesidad ?? mensajesCliente[0] ?? mensajeCliente,
    cotizacion: ultCot ? `Cotización ${ultCot.numero} enviada por ${pesos(ultCot.total)}.` : 'Aún no se ha enviado cotización.',
    datos: formatearDatos(ctx.cliente.datos_contexto ?? {}, ctx.cliente.municipio),
    siguiente_paso: `Responder a: «${mensajeCliente.slice(0, 140)}»`,
  }
  await supabase.from('traspasos').insert({ negocio_id: ctx.negocioId, conversacion_id: ctx.conversacion.id, motivo, resumen_ia: resumen })
  await supabase.from('conversaciones').update({ requiere_asesor: true }).eq('id', ctx.conversacion.id)
  await supabase.from('notificaciones').insert({
    negocio_id: ctx.negocioId, conversacion_id: ctx.conversacion.id, tipo: 'traspaso', titulo: `${ctx.cliente.nombre} necesita un asesor`,
  })
}

function ultimoServicioMencionado(ctx: Contexto): Servicio | null {
  for (let i = ctx.historial.length - 1; i >= 0; i--) {
    const a = ctx.historial[i].adjunto
    if (a && a.tipo === 'precio') return ctx.servicios.find((s) => s.id === a.servicio_id) ?? null
  }
  return null
}

/** Punto de entrada: procesa el mensaje del cliente y responde (o no, si un asesor tomó el chat) */
const SENALES_COMPRA = /\b(agendar|agenda|inscribir|inscribirlo|inscribirla|empezar|comenzar|comprar|contratar|reservar|lo quiero|la quiero|me interesa contratar|como pago|pagar)\b/

export async function procesarMensajeCliente(conversacionId: string, texto: string) {
  const ctx = await cargarContexto(conversacionId)
  if (ctx.conversacion.atendida_por === 'asesor') return // la IA está en pausa en este chat
  if (!ctx.config.activo) return
  await esperar(900 + Math.random() * 700) // simula el tiempo de respuesta real

  const t = normalizar(texto)
  const nombre = ctx.cliente.nombre.split(' ')[0]

  // 1) El cliente pide una persona (si además quiere agendar o pagar, queda listo para comprar)
  if (coincide(texto, /\b(asesor|asesora|persona|humano|alguien|llamar|llamada|hablar con)\b/)) {
    await responder(ctx, `Claro, ${nombre}. Ya le avisé a un asesor de ${ctx.negocioNombre} y te escribe en unos minutos.`)
    if (coincide(texto, SENALES_COMPRA)) {
      await supabase.from('conversaciones').update({ estado_lead: 'listo_para_comprar' }).eq('id', ctx.conversacion.id)
      ctx.conversacion.estado_lead = 'listo_para_comprar'
      await solicitarAsesor(ctx, 'El cliente pidió una persona y está listo para comprar', texto)
    } else {
      await solicitarAsesor(ctx, 'El cliente pidió hablar con una persona', texto)
    }
    return
  }

  // 2) Casos delicados definidos por el dueño
  const regla = ctx.config.reglas_traspaso.find((r) => t.includes(normalizar(r)))
  if (regla) {
    await responder(ctx, `Ese tema lo define directamente el equipo de ${ctx.negocioNombre}. Ya le pasé tu mensaje a un asesor para que te responda en breve.`)
    await solicitarAsesor(ctx, `Caso delicado: el cliente pregunta por «${regla}»`, texto)
    return
  }

  // 3) Interpretación con Claude (si está configurado). Si falla, siguen las reglas.
  const decision = await interpretarConIA(ctx, texto)
  if (decision && await ejecutarDecision(ctx, decision, texto)) return
  ctx.motor = 'reglas'

  // 4) Señales de compra
  if (coincide(texto, SENALES_COMPRA)) {
    await accionAsesor(ctx, 'El cliente está listo para comprar', texto, true)
    return
  }

  const cantidad = extraerCantidad(texto)
  const encontrado = consultarCatalogo(texto, ctx.servicios)
  const previo = ultimoServicioMencionado(ctx)
  const pideCotizacion = coincide(texto, /\b(cotiz\w*|envia\w*|manda\w*|pdf|si|dale|listo|claro|perfecto|de una)\b/)

  // 5) Hay un servicio del catálogo en el mensaje
  const servicio = encontrado ?? ((cantidad || pideCotizacion) ? previo : null)
  if (servicio) {
    const porHora = servicio.unidad === 'hora'
    if (cantidad || (pideCotizacion && !porHora && previo)) await accionCotizar(ctx, servicio, cantidad ?? 1, texto)
    else await accionPrecio(ctx, servicio, texto)
    return
  }

  // 6) Conversación básica
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ola)\b/.test(t) && t.split(' ').length <= 4) {
    await responder(ctx, `¡Hola, ${nombre}! Soy ${ctx.config.nombre_asistente}, el asistente de ${ctx.negocioNombre}. Puedo darte precios, enviarte una cotización formal o pasarte con un asesor. ¿Qué necesitas?`)
    return
  }
  if (/\b(gracias|muchas gracias|listo gracias|ok gracias)\b/.test(t)) {
    await responder(ctx, `¡Con gusto, ${nombre}! Aquí estoy si necesitas algo más.`)
    return
  }

  // 7) Fuera del alcance del catálogo: nunca improvisa, pasa a una persona
  await accionAsesor(ctx, 'Consulta fuera del catálogo validado', texto, false)
}

/* ---------- Acciones: el texto con precios SIEMPRE lo escribe el código con el catálogo activo ---------- */

async function accionPrecio(ctx: Contexto, servicio: Servicio, texto: string) {
  if (servicio.tarifa == null || servicio.estado !== 'listo') return accionSinTarifa(ctx, servicio, texto)
  const nivel = servicio.nivel ? ` (${servicio.nivel})` : ''
  const extra = servicio.unidad === 'hora'
    ? ` Si tomas ${ctx.config.descuento_paquete.minimo} horas o más, tienes ${ctx.config.descuento_paquete.porcentaje} % de descuento. ¿Cuántas horas te gustaría?`
    : ' ¿Quieres que te envíe la cotización formal?'
  await responder(ctx, `${servicio.nombre}${nivel} tiene un valor de ${pesos(servicio.tarifa)} por ${servicio.unidad}.${extra}`,
    { tipo: 'precio', servicio_id: servicio.id })
  await supabase.from('conversaciones').update({ necesidad: servicio.nombre + nivel }).eq('id', ctx.conversacion.id)
}

async function accionCotizar(ctx: Contexto, servicio: Servicio, cantidad: number, texto: string) {
  if (servicio.tarifa == null || servicio.estado !== 'listo') return accionSinTarifa(ctx, servicio, texto)
  try {
    await generarCotizacion(ctx, servicio, cantidad)
  } catch {
    await responder(ctx, 'No pude generar la cotización con el catálogo vigente. Ya le avisé a un asesor.')
    await solicitarAsesor(ctx, 'Error al generar la cotización', texto)
  }
}

async function accionSinTarifa(ctx: Contexto, servicio: Servicio, texto: string) {
  await responder(ctx, `${servicio.nombre} lo cotiza directamente un asesor porque requiere revisar tu caso. Ya le avisé al equipo.`)
  await solicitarAsesor(ctx, `Servicio sin tarifa validada en el catálogo: ${servicio.nombre}`, texto)
}

async function accionAsesor(ctx: Contexto, motivo: string, texto: string, listo: boolean) {
  const nombre = ctx.cliente.nombre.split(' ')[0]
  if (listo) {
    await supabase.from('conversaciones').update({ estado_lead: 'listo_para_comprar' }).eq('id', ctx.conversacion.id)
    ctx.conversacion.estado_lead = 'listo_para_comprar'
    await responder(ctx, `¡Excelente, ${nombre}! Ya le avisé al equipo para confirmar los detalles contigo y dejarlo todo listo.`)
  } else {
    await responder(ctx, `No tengo esa información confirmada, ${nombre}, y prefiero no darte un dato equivocado. Ya le pasé tu mensaje a un asesor de ${ctx.negocioNombre}.`)
  }
  await solicitarAsesor(ctx, motivo, texto)
}

/* ---------- Claude: interpreta el mensaje y elige UNA herramienta ---------- */

interface Decision { herramienta: string; parametros: Record<string, unknown> }

async function interpretarConIA(ctx: Contexto, texto: string): Promise<Decision | null> {
  try {
    const historial = ctx.historial.filter((m) => m.emisor !== 'sistema').slice(0, -1).map((m) => ({ emisor: m.emisor, contenido: m.contenido }))
    const servicios = ctx.servicios.map((s) => ({ id: s.id, nombre: s.nombre, nivel: s.nivel, unidad: s.unidad, tarifa: s.estado === 'listo' ? s.tarifa : null }))
    const pendiente = supabase.functions.invoke('interpretar-mensaje', {
      body: { mensaje: texto, historial, servicios, negocio: ctx.negocioNombre, asistente: ctx.config.nombre_asistente, tono: ctx.config.tono, descuento: ctx.config.descuento_paquete },
    })
    const limite = new Promise<null>((r) => setTimeout(() => r(null), 12000))
    const res = await Promise.race([pendiente, limite])
    if (!res || res.error || !res.data?.herramienta) return null
    return res.data as Decision
  } catch {
    return null
  }
}

/** Valida la decisión del modelo contra el catálogo. Devuelve false si no es válida (entonces deciden las reglas). */
async function ejecutarDecision(ctx: Contexto, d: Decision, texto: string): Promise<boolean> {
  const p = d.parametros ?? {}
  const servicio = typeof p.servicio_id === 'string' ? ctx.servicios.find((s) => s.id === p.servicio_id) : undefined
  ctx.motor = 'claude'
  switch (d.herramienta) {
    case 'informar_precio':
      if (!servicio) return false
      await accionPrecio(ctx, servicio, texto)
      return true
    case 'generar_cotizacion': {
      const cantidad = Number(p.cantidad)
      if (!servicio || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 200) return false
      await accionCotizar(ctx, servicio, cantidad, texto)
      return true
    }
    case 'solicitar_asesor':
      await accionAsesor(ctx, `${String(p.motivo ?? 'El asistente pidió apoyo').slice(0, 160)} (interpretado por IA)`, texto, p.cliente_listo_para_comprar === true)
      return true
    case 'responder': {
      const msg = String(p.mensaje ?? '').trim()
      // nunca deja pasar cifras, precios ni respuestas largas escritas por el modelo
      if (!msg || msg.length > 400 || /\$|cop|\d{3,}|\d+\s*%/i.test(msg)) return false
      await responder(ctx, msg)
      return true
    }
    default:
      return false
  }
}
