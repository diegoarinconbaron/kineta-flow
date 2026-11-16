// Kineta Flow · Función en la nube que interpreta el mensaje del cliente con Claude.
//
// Claude NO escribe precios ni cotizaciones: solo decide cuál de las herramientas usar
// y con qué parámetros. El navegador valida la decisión y el código genera el texto con
// las tarifas del catálogo activo. Si esta función falla, la app usa el motor de reglas.

const MODELO = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Servicio { id: string; nombre: string; nivel: string | null; unidad: string; tarifa: number | null }
interface Entrada {
  mensaje: string
  historial: { emisor: string; contenido: string }[]
  servicios: Servicio[]
  negocio: string
  asistente: string
  tono: string
  descuento: { minimo: number; porcentaje: number }
}

const HERRAMIENTAS = [
  {
    name: 'informar_precio',
    description: 'El cliente pregunta por un servicio del catálogo pero todavía no indicó la cantidad. El sistema le dirá la tarifa exacta.',
    input_schema: { type: 'object', properties: { servicio_id: { type: 'string', description: 'id exacto del servicio del catálogo' } }, required: ['servicio_id'] },
  },
  {
    name: 'generar_cotizacion',
    description: 'El cliente ya indicó qué servicio y qué cantidad quiere (o acepta recibir la cotización). El sistema genera la cotización formal en PDF.',
    input_schema: {
      type: 'object',
      properties: {
        servicio_id: { type: 'string', description: 'id exacto del servicio del catálogo' },
        cantidad: { type: 'integer', minimum: 1, maximum: 200, description: 'horas o unidades pedidas; 1 si el servicio se vende por unidad y no dijo cantidad' },
      },
      required: ['servicio_id', 'cantidad'],
    },
  },
  {
    name: 'solicitar_asesor',
    description: 'Pasar la conversación a una persona: el cliente lo pide, quiere comprar o agendar, pregunta por descuentos especiales, becas, financiación, garantías o cualquier cosa que no esté en el catálogo.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'motivo corto para el asesor, en español' },
        cliente_listo_para_comprar: { type: 'boolean', description: 'true si el cliente quiere comprar, inscribirse, agendar o pagar' },
      },
      required: ['motivo', 'cliente_listo_para_comprar'],
    },
  },
  {
    name: 'responder',
    description: 'Solo para saludar, agradecer o pedir un dato que falta (por ejemplo el nivel o el servicio). Prohibido mencionar precios, cifras, descuentos, fechas o promesas.',
    input_schema: { type: 'object', properties: { mensaje: { type: 'string', description: 'respuesta breve en español' } }, required: ['mensaje'] },
  },
]

function sistema(e: Entrada) {
  const catalogo = e.servicios
    .map((s) => `- id ${s.id} · ${s.nombre}${s.nivel ? ` (${s.nivel})` : ''} · por ${s.unidad} · ${s.tarifa == null ? 'SIN TARIFA: siempre pasa a asesor' : 'con tarifa'}`)
    .join('\n')
  return `Eres ${e.asistente}, el asistente de WhatsApp de ${e.negocio}, una pyme colombiana. Tono: ${e.tono === 'profesional' ? 'profesional, trato de usted' : 'cercano, tuteas al cliente'}.
Tu único trabajo es atender consultas comerciales sobre el catálogo del negocio. No eres un asistente de propósito general.
Siempre respondes llamando exactamente UNA herramienta. Nunca escribes precios ni cifras: el sistema los toma del catálogo.
Si el servicio no está en el catálogo, si tiene "SIN TARIFA" o si dudas, usa solicitar_asesor. Si el mensaje es ambiguo entre varios servicios (por ejemplo, no dice el nivel), usa responder para preguntar.
Descuento por paquete vigente: desde ${e.descuento.minimo} unidades, ${e.descuento.porcentaje} %.

Catálogo activo:
${catalogo}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  // acepta también el nombre con espacios, por si el secreto se guardó así en el panel
  const clave = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('ANTHROPIC API KEY')
  if (!clave) return Response.json({ error: 'sin_clave' }, { status: 503, headers: CORS })
  try {
    const e = (await req.json()) as Entrada
    if (!e?.mensaje || !Array.isArray(e.servicios)) return Response.json({ error: 'entrada_invalida' }, { status: 400, headers: CORS })
    const turnos = [
      ...e.historial.slice(-10).map((m) => ({ role: m.emisor === 'cliente' ? 'user' : 'assistant', content: m.contenido })),
      { role: 'user', content: e.mensaje },
    ]
    // la API exige alternar roles y empezar por el usuario: se fusionan turnos seguidos del mismo rol
    const mensajes: { role: string; content: string }[] = []
    for (const t of turnos) {
      const ult = mensajes[mensajes.length - 1]
      if (ult && ult.role === t.role) ult.content += '\n' + t.content
      else mensajes.push({ ...t })
    }
    while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift()

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO, max_tokens: 400, system: sistema(e),
        tools: HERRAMIENTAS, tool_choice: { type: 'any' }, messages: mensajes,
      }),
    })
    if (!r.ok) return Response.json({ error: 'claude_' + r.status, detalle: (await r.text()).slice(0, 300) }, { status: 502, headers: CORS })
    const datos = await r.json()
    const uso = datos.content?.find((c: { type: string }) => c.type === 'tool_use')
    if (!uso) return Response.json({ error: 'sin_herramienta' }, { status: 502, headers: CORS })
    return Response.json({ herramienta: uso.name, parametros: uso.input, modelo: MODELO }, { headers: CORS })
  } catch (err) {
    return Response.json({ error: 'excepcion', detalle: String(err).slice(0, 300) }, { status: 500, headers: CORS })
  }
})
