import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, Bot, Hand, Send, Undo2, Sparkles, Moon, Search, FileText, ArrowLeft } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { ESTADOS, haceCuanto, normalizar, pesos, fechaCorta } from '../lib/formato'
import { abrirCotizacionPdf } from '../lib/pdf'
import { Avatar, EtiquetaEstado } from '../components/Marca'
import { Burbuja } from '../components/Burbuja'
import type { Conversacion, Cotizacion, EstadoLead, Mensaje, Traspaso } from '../lib/tipos'

type Pestana = 'asesor' | 'todas' | 'ia' | 'mias'

export default function Conversaciones() {
  const { negocio, miembro } = useSesion()
  const [params, setParams] = useSearchParams()
  const seleccion = params.get('c')
  const [lista, setLista] = useState<Conversacion[]>([])
  const [pestana, setPestana] = useState<Pestana>('asesor')
  const [busqueda, setBusqueda] = useState('')
  const [conv, setConv] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [traspaso, setTraspaso] = useState<Traspaso | null>(null)
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const fin = useRef<HTMLDivElement>(null)
  const caja = useRef<HTMLTextAreaElement>(null)

  const cargarLista = async () => {
    if (!negocio) return
    const { data } = await supabase.from('conversaciones').select('*, clientes(nombre, telefono, municipio, datos_contexto)')
      .eq('negocio_id', negocio.id).order('ultimo_mensaje_en', { ascending: false }).limit(300)
    setLista((data ?? []) as Conversacion[])
  }

  const cargarDetalle = async (id: string) => {
    const [{ data: c }, { data: ms }, { data: tr }, { data: cots }] = await Promise.all([
      supabase.from('conversaciones').select('*, clientes(nombre, telefono, municipio, datos_contexto)').eq('id', id).single(),
      supabase.from('mensajes').select('*').eq('conversacion_id', id).order('creado_en'),
      supabase.from('traspasos').select('*').eq('conversacion_id', id).order('solicitado_en', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('cotizaciones').select('*').eq('conversacion_id', id).order('creada_en', { ascending: false }),
    ])
    setConv(c as Conversacion); setMensajes((ms ?? []) as Mensaje[]); setTraspaso(tr as Traspaso); setCotizaciones((cots ?? []) as Cotizacion[])
  }

  useEffect(() => { cargarLista() }, [negocio?.id])

  useEffect(() => {
    if (!negocio) return
    const canal = supabase.channel('conv-lista-' + negocio.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones', filter: `negocio_id=eq.${negocio.id}` }, () => cargarLista())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [negocio?.id])

  useEffect(() => {
    if (!seleccion) { setConv(null); return }
    cargarDetalle(seleccion)
    const canal = supabase.channel('conv-' + seleccion)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${seleccion}` }, () => cargarDetalle(seleccion))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traspasos', filter: `conversacion_id=eq.${seleccion}` }, () => cargarDetalle(seleccion))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones', filter: `id=eq.${seleccion}` }, () => cargarDetalle(seleccion))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [seleccion])

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes.length, seleccion])

  // si llega con ?c= de una conversación que no requiere asesor, mostrar "Todas"
  useEffect(() => {
    if (seleccion && lista.length) {
      const c = lista.find((x) => x.id === seleccion)
      if (c && !c.requiere_asesor && pestana === 'asesor') setPestana('todas')
    }
  }, [seleccion, lista.length])

  const filtradas = useMemo(() => lista.filter((c) => {
    if (pestana === 'asesor' && !c.requiere_asesor) return false
    if (pestana === 'ia' && c.atendida_por !== 'ia') return false
    if (pestana === 'mias' && c.asesor_id !== miembro?.id) return false
    return !busqueda || normalizar(`${c.clientes?.nombre} ${c.necesidad}`).includes(normalizar(busqueda))
  }), [lista, pestana, busqueda, miembro?.id])

  const nRequieren = lista.filter((c) => c.requiere_asesor).length
  const numeroDe = (id: string) => cotizaciones.find((c) => c.id === id)?.numero

  const sistema = (contenido: string) => supabase.from('mensajes').insert({ conversacion_id: conv!.id, negocio_id: conv!.negocio_id, emisor: 'sistema', contenido })

  /** HU-04: tomar la conversación con un clic -> la IA se pausa solo en este chat */
  const tomar = async () => {
    if (!conv || !miembro) return
    setTrabajando(true)
    await supabase.from('conversaciones').update({ atendida_por: 'asesor', asesor_id: miembro.id, requiere_asesor: false }).eq('id', conv.id)
    if (traspaso && !traspaso.tomado_en) await supabase.from('traspasos').update({ tomado_por: miembro.id, tomado_en: new Date().toISOString() }).eq('id', traspaso.id)
    await supabase.from('notificaciones').update({ leida: true }).eq('conversacion_id', conv.id)
    await sistema(`${miembro.nombre} tomó la conversación. El asistente queda en pausa solo en este chat.`)
    setTrabajando(false)
    setTimeout(() => caja.current?.focus(), 100)
  }

  const devolver = async () => {
    if (!conv || !miembro) return
    setTrabajando(true)
    await supabase.from('conversaciones').update({ atendida_por: 'ia', asesor_id: null }).eq('id', conv.id)
    if (traspaso) await supabase.from('traspasos').update({ devuelto_en: new Date().toISOString() }).eq('id', traspaso.id)
    await sistema(`${miembro.nombre} devolvió la conversación al asistente.`)
    setTrabajando(false)
  }

  const enviar = async () => {
    if (!conv || !texto.trim()) return
    const t = texto.trim(); setTexto('')
    await supabase.from('mensajes').insert({ conversacion_id: conv.id, negocio_id: conv.negocio_id, emisor: 'asesor', contenido: t })
    await supabase.from('conversaciones').update({ ultimo_mensaje_en: new Date().toISOString() }).eq('id', conv.id)
  }

  const cambiarEstado = async (e: EstadoLead) => {
    if (!conv) return
    await supabase.from('conversaciones').update({ estado_lead: e }).eq('id', conv.id)
  }

  const tomadaPorMi = conv?.atendida_por === 'asesor' && conv.asesor_id === miembro?.id
  const tomadaPorOtro = conv?.atendida_por === 'asesor' && conv.asesor_id !== miembro?.id
  const datos = (conv?.clientes?.datos_contexto ?? {}) as Record<string, unknown>

  const PESTANAS: { id: Pestana; t: string; n?: number }[] = [
    { id: 'asesor', t: 'Requieren asesor', n: nRequieren }, { id: 'todas', t: 'Todas' }, { id: 'ia', t: 'Atendidas por IA' }, { id: 'mias', t: 'Mías' },
  ]

  return (
    <div className="flex h-full min-h-0">
      {/* Bandeja */}
      <section className={clsx('flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-80 lg:w-96', seleccion && 'hidden md:flex')}>
        <div className="border-b border-slate-200 p-4">
          <h1 className="text-lg font-semibold">Conversaciones</h1>
          <div className="mt-3 flex flex-wrap gap-1" role="tablist">
            {PESTANAS.map((p) => (
              <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
                className={clsx('whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition',
                  pestana === p.id ? (p.id === 'asesor' ? 'bg-urgente text-white' : 'bg-noche text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {p.t}{p.n !== undefined && ` (${p.n})`}
              </button>
            ))}
          </div>
          <label className="relative mt-3 block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input className="campo pl-9" placeholder="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar conversación" />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtradas.length === 0 && <li className="p-8 text-center text-sm text-slate-500">{pestana === 'asesor' ? 'Nadie está esperando a un asesor.' : 'Sin conversaciones.'}</li>}
          {filtradas.slice(0, 120).map((c) => (
            <li key={c.id}>
              <button onClick={() => setParams({ c: c.id })}
                className={clsx('flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50',
                  c.id === seleccion && 'bg-indigo-50/70', c.requiere_asesor && 'border-l-4 border-l-urgente bg-red-50/40')}>
                <Avatar nombre={c.clientes?.nombre ?? '?'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.clientes?.nombre}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{haceCuanto(c.ultimo_mensaje_en)}</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">{c.necesidad}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {c.requiere_asesor && <span className="rounded-full bg-urgente px-2 py-0.5 text-[10px] font-semibold text-white">Requiere asesor</span>}
                    <EtiquetaEstado estado={c.estado_lead} />
                    {c.atendida_por === 'asesor' && <span className="text-[10px] text-slate-500">· con asesor</span>}
                    {c.fuera_de_horario && <Moon className="h-3 w-3 text-amber-600" aria-label="Fuera de horario" />}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Chat */}
      {conv ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button className="btn-fantasma px-2 md:hidden" onClick={() => setParams({})} aria-label="Volver a la bandeja"><ArrowLeft className="h-4 w-4" /></button>
            <Avatar nombre={conv.clientes?.nombre ?? '?'} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{conv.clientes?.nombre}</div>
              <div className="text-xs text-slate-500">{conv.clientes?.telefono} · {conv.atendida_por === 'ia' ? 'Atendida por el asistente' : 'Atendida por un asesor'}</div>
            </div>
            <select className="campo w-44" value={conv.estado_lead} onChange={(e) => cambiarEstado(e.target.value as EstadoLead)} aria-label="Estado del lead">
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.etiqueta}</option>)}
            </select>
          </div>

          {conv.requiere_asesor && (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-urgente" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-red-800">{conv.clientes?.nombre?.split(' ')[0]} necesita hablar con una persona</div>
                <div className="text-xs text-red-700">{traspaso?.motivo ?? 'El asistente pidió apoyo de tu equipo.'}{traspaso && ` · ${haceCuanto(traspaso.solicitado_en)}`}</div>
              </div>
              <button className="btn-urgente" onClick={tomar} disabled={trabajando}><Hand className="h-4 w-4" />Tomar conversación</button>
            </div>
          )}

          <div className="wa-fondo min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {mensajes.map((m) => <Burbuja key={m.id} m={m} modo="panel" numeroCot={m.adjunto?.tipo === 'cotizacion' ? numeroDe(m.adjunto.cotizacion_id) : undefined} />)}
            <div ref={fin} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {tomadaPorMi ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-800"><Hand className="h-3.5 w-3.5" />Estás atendiendo este chat. El asistente está en pausa solo aquí.</span>
                  <button className="btn-fantasma px-2 py-1 text-xs" onClick={devolver} disabled={trabajando}><Undo2 className="h-3.5 w-3.5" />Devolver a la IA</button>
                </div>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); enviar() }}>
                  <textarea ref={caja} rows={1} className="campo resize-none" placeholder="Escribe tu respuesta al cliente…" value={texto}
                    onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} aria-label="Mensaje para el cliente" />
                  <button className="btn-primario" disabled={!texto.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></button>
                </form>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  {tomadaPorOtro ? 'Otro asesor está atendiendo esta conversación.' : <span className="flex items-center gap-1.5"><Bot className="h-4 w-4 text-indigo-600" />El asistente está atendiendo. Toma la conversación para escribir.</span>}
                </div>
                {!conv.requiere_asesor && !tomadaPorOtro && <button className="btn-secundario" onClick={tomar} disabled={trabajando}><Hand className="h-4 w-4" />Tomar conversación</button>}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="hidden flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 md:flex">
          <div><Bot className="mx-auto mb-3 h-10 w-10 text-slate-300" />Selecciona una conversación para ver el historial.</div>
        </section>
      )}

      {/* Resumen para el asesor */}
      {conv && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-indigo-600" />Resumen para el asesor</h2>
          <p className="text-xs text-slate-500">Generado por el asistente al pasar la conversación</p>
          {traspaso ? (
            <dl className="mt-4 space-y-3 text-sm">
              {[['Necesidad', traspaso.resumen_ia.necesidad], ['Cotización', traspaso.resumen_ia.cotizacion], ['Datos del cliente', traspaso.resumen_ia.datos], ['Siguiente paso sugerido', traspaso.resumen_ia.siguiente_paso]].map(([k, v]) => v && (
                <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5">{v}</dd></div>
              ))}
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Motivo del traspaso</dt>
                <dd className="mt-0.5 text-red-900">{traspaso.motivo}</dd>
              </div>
            </dl>
          ) : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Esta conversación no ha requerido un asesor. El asistente la está resolviendo.</p>}

          <h3 className="mt-6 text-sm font-semibold">Cliente</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Teléfono</dt><dd>{conv.clientes?.telefono}</dd></div>
            {conv.clientes?.municipio && <div className="flex justify-between gap-2"><dt className="text-slate-500">Municipio</dt><dd>{conv.clientes.municipio}</dd></div>}
            {Object.entries(datos).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500 capitalize">{k.replace(/_/g, ' ').replace('kwh mes', '(kWh/mes)')}</dt><dd className="text-right">{String(v)}</dd></div>
            ))}
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Primer contacto</dt><dd>{fechaCorta(conv.iniciada_en)}{conv.fuera_de_horario && ' · fuera de horario'}</dd></div>
          </dl>

          <h3 className="mt-6 text-sm font-semibold">Cotizaciones</h3>
          {cotizaciones.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin cotizaciones.</p> : (
            <ul className="mt-2 space-y-2">
              {cotizaciones.map((c) => (
                <li key={c.id}>
                  <button onClick={() => abrirCotizacionPdf(c.id)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-left text-sm hover:bg-slate-50">
                    <FileText className="h-4 w-4 text-urgente" />
                    <span className="flex-1"><span className="block font-medium">{c.numero}</span><span className="text-xs text-slate-500">{fechaCorta(c.creada_en)}</span></span>
                    <span className="font-medium tabular-nums">{pesos(c.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </div>
  )
}
