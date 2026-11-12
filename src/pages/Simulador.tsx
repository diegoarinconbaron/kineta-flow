import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Send, Phone, Video, MoreVertical, Info, Plus, RotateCcw } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { fueraDeHorario } from '../lib/formato'
import { procesarMensajeCliente } from '../lib/asistente'
import { Burbuja } from '../components/Burbuja'
import type { Mensaje } from '../lib/tipos'

const SUGERENCIAS: Record<string, string[]> = {
  '11111111-1111-1111-1111-111111111111': [
    'Hola, ¿cuánto cuesta la monitoría de cálculo diferencial para universidad?',
    'Serían 10 horas',
    '¿Tienen descuento por hermanos?',
    '¿Cuánto vale la monitoría grupal?',
    'Quiero hablar con un asesor',
  ],
  '22222222-2222-2222-2222-222222222222': [
    'Buenas, ¿cuánto vale un sistema solar on-grid de 5 kWp para mi casa?',
    'Sí, envíame la cotización',
    '¿Tienen financiación?',
    '¿Cuánto cuesta la visita técnica?',
    'Necesito hablar con una persona',
  ],
}

const CLAVE = 'kf-simulador-'

export default function Simulador() {
  const { negocio, config } = useSesion()
  const [nombre, setNombre] = useState('')
  const [convId, setConvId] = useState<string | null>(null)
  const [nombreCliente, setNombreCliente] = useState('')
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cotNums, setCotNums] = useState<Record<string, string>>({})
  const [texto, setTexto] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)
  const fin = useRef<HTMLDivElement>(null)

  // recordar la conversación de prueba entre recargas (comodidad del demo)
  useEffect(() => {
    if (!negocio) return
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE + negocio.id) ?? 'null')
      if (g) { setConvId(g.id); setNombreCliente(g.nombre) }
    } catch { /* sin almacenamiento */ }
  }, [negocio?.id])

  const cargar = async (id: string) => {
    const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', id).order('creado_en')
    const ms = (data ?? []) as Mensaje[]
    setMensajes(ms)
    const ids = ms.flatMap((m) => (m.adjunto?.tipo === 'cotizacion' ? [m.adjunto.cotizacion_id] : []))
    if (ids.length) {
      const { data: c } = await supabase.from('cotizaciones').select('id, numero').in('id', ids)
      setCotNums(Object.fromEntries((c ?? []).map((x) => [x.id, x.numero])))
    }
  }

  useEffect(() => {
    if (!convId) return
    cargar(convId)
    const canal = supabase.channel('sim-' + convId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${convId}` }, () => cargar(convId))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [convId])

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes.length, escribiendo])

  const iniciar = async () => {
    if (!negocio || !nombre.trim()) return
    const telefono = '+57 3' + String(Math.floor(100000000 + Math.random() * 899999999))
    const { data: cli } = await supabase.from('clientes').insert({ negocio_id: negocio.id, nombre: nombre.trim(), telefono }).select().single()
    if (!cli) return
    const { data: c } = await supabase.from('conversaciones').insert({
      negocio_id: negocio.id, cliente_id: cli.id, fuera_de_horario: fueraDeHorario(config), necesidad: 'Consulta por WhatsApp',
    }).select().single()
    if (!c) return
    setConvId(c.id); setNombreCliente(cli.nombre); setMensajes([])
    try { localStorage.setItem(CLAVE + negocio.id, JSON.stringify({ id: c.id, nombre: cli.nombre })) } catch { /* sin almacenamiento */ }
  }

  const reiniciar = () => {
    setConvId(null); setMensajes([]); setNombre('')
    try { if (negocio) localStorage.removeItem(CLAVE + negocio.id) } catch { /* sin almacenamiento */ }
  }

  const enviar = async (t: string) => {
    if (!convId || !negocio || !t.trim()) return
    setTexto('')
    await supabase.from('mensajes').insert({ conversacion_id: convId, negocio_id: negocio.id, emisor: 'cliente', contenido: t.trim() })
    await supabase.from('conversaciones').update({ ultimo_mensaje_en: new Date().toISOString() }).eq('id', convId)
    setEscribiendo(true)
    try { await procesarMensajeCliente(convId, t.trim()) } finally { setEscribiendo(false) }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 p-4 md:p-8 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-2xl font-semibold">Simulador de WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">Así ve el cliente final la conversación con el asistente de {negocio?.nombre}. Cada mensaje se guarda en la base de datos y aparece en tiempo real en «Conversaciones».</p>

        <div className="tarjeta mt-6 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-indigo-600" />Cómo probarlo</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Escribe el nombre de un cliente ficticio e inicia el chat.</li>
            <li>Pregunta por un servicio: el asistente responde con la tarifa del <Link to="/catalogo" className="text-indigo-600 hover:underline">catálogo activo</Link>.</li>
            <li>Indica una cantidad para recibir la cotización en PDF.</li>
            <li>Pregunta por un caso delicado o pide un asesor: aparecerá la alerta en el panel.</li>
            <li>Abre <Link to="/conversaciones" className="text-indigo-600 hover:underline">Conversaciones</Link> en otra pestaña, toma el chat y responde: tu mensaje llega aquí.</li>
          </ol>
          {convId && (
            <>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Mensajes de ejemplo</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(SUGERENCIAS[negocio?.id ?? ''] ?? []).map((s) => (
                  <button key={s} onClick={() => enviar(s)} disabled={escribiendo} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-left text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{s}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          En la fase piloto, este simulador se reemplaza por la conexión con la API oficial de WhatsApp Business. El asistente solo atiende consultas comerciales del negocio: lo que no está en el catálogo pasa a una persona.
        </p>
      </div>

      {/* Teléfono */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-noche bg-noche shadow-2xl">
          <div className="flex items-center gap-3 bg-[#075E54] px-3 py-3 text-white">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-[#075E54]">{negocio?.nombre.split(' ').map((p) => p[0]).join('').slice(0, 2)}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{negocio?.nombre}</div>
              <div className="text-[11px] text-emerald-100">{escribiendo ? 'escribiendo…' : 'Cuenta de empresa'}</div>
            </div>
            <Video className="h-5 w-5" aria-hidden="true" /><Phone className="h-5 w-5" aria-hidden="true" /><MoreVertical className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="wa-fondo flex h-[520px] flex-col">
            {!convId ? (
              <div className="m-auto w-72 rounded-xl bg-white p-5 shadow">
                <div className="text-sm font-semibold">Nuevo chat de prueba</div>
                <p className="mt-1 text-xs text-slate-500">Escribe como si fueras un cliente del negocio.</p>
                <form onSubmit={(e) => { e.preventDefault(); iniciar() }}>
                  <label htmlFor="nombre-cliente" className="etiqueta-campo mt-3">Nombre del cliente</label>
                  <input id="nombre-cliente" className="campo" placeholder="Ej.: Sandra Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  <button className="btn-primario mt-3 w-full" disabled={!nombre.trim()}><Plus className="h-4 w-4" />Iniciar chat</button>
                </form>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 pt-2">
                  <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-slate-600">Escribiendo como: {nombreCliente}</span>
                  <button onClick={reiniciar} className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-white"><RotateCcw className="h-3 w-3" />Nuevo cliente</button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <div className="mx-auto my-2 w-fit rounded-md bg-amber-50 px-3 py-1 text-center text-[10px] text-amber-800">🔒 Los mensajes se guardan para que el negocio te atienda mejor.</div>
                  {mensajes.map((m) => <Burbuja key={m.id} m={m} modo="whatsapp" numeroCot={m.adjunto?.tipo === 'cotizacion' ? cotNums[m.adjunto.cotizacion_id] : undefined} onBoton={(o) => enviar(o)} />)}
                  {escribiendo && <div className="my-1 w-fit rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm"><span className="escribiendo text-lg leading-none text-slate-400"><span>•</span><span>•</span><span>•</span></span></div>}
                  <div ref={fin} />
                </div>
                <form className="flex items-center gap-2 bg-[#F0F2F5] p-2" onSubmit={(e) => { e.preventDefault(); enviar(texto) }}>
                  <input className="flex-1 rounded-full border-0 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Mensaje" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje del cliente" />
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00A884] text-white disabled:opacity-50" disabled={!texto.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
