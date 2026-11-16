import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Building2, MessageCircle, FileSpreadsheet, Clock, Check, X, Plus, Lock, CalendarCheck, Loader2 } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import type { Configuracion as TConfig } from '../lib/tipos'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function Configuracion() {
  const { negocio, config, esDueno, recargarConfig } = useSesion()
  const [f, setF] = useState<TConfig | null>(null)
  const [nuevaRegla, setNuevaRegla] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)
  const [tieneCatalogo, setTieneCatalogo] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => { if (config) setF(structuredClone(config)) }, [config])
  useEffect(() => {
    if (!negocio) return
    supabase.from('catalogos').select('id').eq('negocio_id', negocio.id).eq('estado', 'activo').maybeSingle().then(({ data }) => setTieneCatalogo(!!data))
  }, [negocio?.id])

  if (!f) return null
  const editable = esDueno
  const set = (p: Partial<TConfig>) => { setF({ ...f, ...p }); setOk(false) }

  const guardar = async () => {
    setGuardando(true)
    await supabase.from('configuracion_asistente').update({
      activo: f.activo, nombre_asistente: f.nombre_asistente, tono: f.tono, horario_laboral: f.horario_laboral,
      reglas_traspaso: f.reglas_traspaso, descuento_paquete: f.descuento_paquete, actualizado_en: new Date().toISOString(),
    }).eq('negocio_id', f.negocio_id)
    await recargarConfig()
    setGuardando(false); setOk(true)
  }

  const pasos = [
    { icono: Building2, t: 'Datos del negocio', hecho: true },
    { icono: MessageCircle, t: 'Conectar WhatsApp Business', hecho: true, nota: 'Simulador (piloto: API oficial)' },
    { icono: FileSpreadsheet, t: 'Cargar catálogo', hecho: tieneCatalogo },
    { icono: Clock, t: 'Horario y tono', hecho: true },
  ]

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Configuración del asistente</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Enséñale al asistente cómo atender a tus clientes. No necesitas saber de inteligencia artificial.</p>
        {editable && <Link to="/configuracion/guiada" className="btn-secundario text-sm">Abrir la configuración guiada</Link>}
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-4">
        {pasos.map((p, i) => (
          <li key={p.t} className={clsx('tarjeta flex items-center gap-3 p-3', p.hecho && 'border-green-200')}>
            <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', p.hecho ? 'bg-exito text-white' : 'bg-slate-100 text-slate-500')}>
              {p.hecho ? <Check className="h-4 w-4" aria-label="Completado" /> : i + 1}
            </span>
            <span className="text-sm leading-tight"><span className="block font-medium">{p.t}</span>{p.nota && <span className="text-[11px] text-slate-500">{p.nota}</span>}</span>
          </li>
        ))}
      </ol>

      {!editable && <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-600"><Lock className="h-4 w-4" />Solo el dueño puede cambiar la configuración.</p>}

      <fieldset disabled={!editable} className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="font-semibold">El asistente</h2>
          <label className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span><span className="block text-sm font-medium">Asistente activo</span><span className="text-xs text-slate-500">Si lo pausas, los mensajes esperan a tu equipo</span></span>
            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={f.activo} onChange={(e) => set({ activo: e.target.checked })} />
          </label>
          <div className="mt-4"><label className="etiqueta-campo" htmlFor="nombre-asis">Nombre con el que se presenta</label>
            <input id="nombre-asis" className="campo" value={f.nombre_asistente} onChange={(e) => set({ nombre_asistente: e.target.value })} /></div>
          <div className="mt-4"><label className="etiqueta-campo" htmlFor="tono">Tono</label>
            <select id="tono" className="campo" value={f.tono} onChange={(e) => set({ tono: e.target.value })}>
              <option value="cercano">Cercano (tutea al cliente)</option><option value="profesional">Profesional (trato de usted)</option>
            </select></div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><label className="etiqueta-campo" htmlFor="dmin">Descuento por paquete desde</label>
              <input id="dmin" type="number" min={1} className="campo" value={f.descuento_paquete.minimo} onChange={(e) => set({ descuento_paquete: { ...f.descuento_paquete, minimo: Number(e.target.value) } })} /></div>
            <div><label className="etiqueta-campo" htmlFor="dpct">Porcentaje de descuento</label>
              <input id="dpct" type="number" min={0} max={50} className="campo" value={f.descuento_paquete.porcentaje} onChange={(e) => set({ descuento_paquete: { ...f.descuento_paquete, porcentaje: Number(e.target.value) } })} /></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Ejemplo: desde {f.descuento_paquete.minimo} unidades u horas, {f.descuento_paquete.porcentaje} % de descuento en la cotización.</p>
        </section>

        <section className="tarjeta p-5">
          <h2 className="font-semibold">Horario laboral</h2>
          <p className="text-xs text-slate-500">Lo que llegue fuera de este horario se marca como «fuera de horario» en tu resumen.</p>
          <div className="mt-3 space-y-2">
            {DIAS.map((d, i) => {
              const k = String(i + 1); const franja = f.horario_laboral[k]
              return (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <label className="flex w-28 items-center gap-2">
                    <input type="checkbox" className="accent-indigo-600" checked={!!franja}
                      onChange={(e) => { const h = { ...f.horario_laboral }; if (e.target.checked) h[k] = ['08:00', '18:00']; else delete h[k]; set({ horario_laboral: h }) }} />{d}
                  </label>
                  {franja ? (
                    <>
                      <input type="time" className="campo w-28 py-1" value={franja[0]} aria-label={`${d} desde`} onChange={(e) => set({ horario_laboral: { ...f.horario_laboral, [k]: [e.target.value, franja[1]] } })} />
                      <span className="text-slate-400">a</span>
                      <input type="time" className="campo w-28 py-1" value={franja[1]} aria-label={`${d} hasta`} onChange={(e) => set({ horario_laboral: { ...f.horario_laboral, [k]: [franja[0], e.target.value] } })} />
                    </>
                  ) : <span className="text-xs text-slate-400">Cerrado</span>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="tarjeta p-5 lg:col-span-2">
          <h2 className="font-semibold">Casos que siempre pasan a una persona</h2>
          <p className="text-xs text-slate-500">Si el cliente menciona alguna de estas palabras, el asistente no responde por su cuenta: avisa a tu equipo y entrega un resumen.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {f.reglas_traspaso.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-red-50 py-1 pl-3 pr-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                {r}{editable && <button type="button" onClick={() => set({ reglas_traspaso: f.reglas_traspaso.filter((x) => x !== r) })} className="rounded-full p-0.5 hover:bg-red-100" aria-label={`Quitar ${r}`}><X className="h-3 w-3" /></button>}
              </span>
            ))}
          </div>
          {editable && (
            <form className="mt-3 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); if (nuevaRegla.trim()) { set({ reglas_traspaso: [...f.reglas_traspaso, nuevaRegla.trim().toLowerCase()] }); setNuevaRegla('') } }}>
              <input className="campo" placeholder="Ej.: convenio empresarial" value={nuevaRegla} onChange={(e) => setNuevaRegla(e.target.value)} aria-label="Nueva palabra" />
              <button className="btn-secundario"><Plus className="h-4 w-4" />Agregar</button>
            </form>
          )}
          <p className="mt-4 text-xs text-slate-500">Además, el asistente siempre pasa a una persona cuando el cliente pide un asesor, cuando un servicio no tiene tarifa en el <Link to="/catalogo" className="text-indigo-600 hover:underline">catálogo</Link> o cuando la pregunta no está en él.</p>
        </section>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button className="btn-secundario" onClick={() => setModal(true)}><CalendarCheck className="h-4 w-4" />Agendar acompañamiento con Kineta Lab</button>
        {editable && (
          <div className="flex items-center gap-3">
            {ok && <span role="status" className="flex items-center gap-1 text-sm text-exito"><Check className="h-4 w-4" />Cambios guardados</span>}
            <button className="btn-primario" onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/50 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
          <div className="tarjeta w-full max-w-md p-6">
            <h2 id="titulo-modal" className="text-lg font-semibold">Implementación acompañada</h2>
            <p className="mt-2 text-sm text-slate-600">Un asesor de Kineta Lab configura contigo el asistente, carga tu catálogo y define las reglas de traspaso en una sesión de 60 minutos.</p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">En este prototipo la agenda no está conectada. En el producto, este botón abre el calendario del equipo de implementación.</p>
            <div className="mt-5 flex justify-end"><button className="btn-primario" onClick={() => setModal(false)}>Entendido</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
