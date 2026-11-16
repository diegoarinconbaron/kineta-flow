import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Building2, MessageCircle, FileSpreadsheet, Clock, Check, ArrowLeft, ArrowRight, Loader2, Lock, Smartphone, Rocket } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import type { Configuracion } from '../lib/tipos'

const PASOS = [
  { t: 'Tu negocio', d: 'Cómo te verán tus clientes', I: Building2 },
  { t: 'WhatsApp', d: 'El número donde te escriben', I: MessageCircle },
  { t: 'Catálogo', d: 'Precios que el asistente usará', I: FileSpreadsheet },
  { t: 'Horario y tono', d: 'Cómo y cuándo atiende', I: Clock },
]

const HORARIOS: Record<string, { t: string; h: Configuracion['horario_laboral'] }> = {
  semana: { t: 'Lunes a viernes, 8:00 a 18:00', h: { 1: ['08:00', '18:00'], 2: ['08:00', '18:00'], 3: ['08:00', '18:00'], 4: ['08:00', '18:00'], 5: ['08:00', '18:00'] } },
  sabado: { t: 'Lunes a sábado (sábado hasta las 13:00)', h: { 1: ['08:00', '18:00'], 2: ['08:00', '18:00'], 3: ['08:00', '18:00'], 4: ['08:00', '18:00'], 5: ['08:00', '18:00'], 6: ['08:00', '13:00'] } },
}

/** Configuración guiada en 4 pasos (Frame 1 del prototipo de baja fidelidad). */
export default function ConfiguracionGuiada() {
  const { negocio, config, esDueno, recargarConfig } = useSesion()
  const navegar = useNavigate()
  const [paso, setPaso] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState({ nombre: '', sector: '', ciudad: '', telefono: '' })
  const [asis, setAsis] = useState({ nombre: '', tono: 'cercano', horario: 'actual', activo: true })
  const [catalogo, setCatalogo] = useState<{ version: number; servicios: number; sinTarifa: number } | null>(null)

  useEffect(() => {
    if (negocio) setDatos({ nombre: negocio.nombre, sector: negocio.sector, ciudad: negocio.ciudad, telefono: negocio.telefono_whatsapp ?? '' })
    if (config) setAsis({ nombre: config.nombre_asistente, tono: config.tono, horario: 'actual', activo: config.activo })
  }, [negocio?.id, config?.negocio_id])

  useEffect(() => {
    if (!negocio) return
    ;(async () => {
      const { data: c } = await supabase.from('catalogos').select('id, version').eq('negocio_id', negocio.id).eq('estado', 'activo').maybeSingle()
      if (!c) return setCatalogo(null)
      const { data: s } = await supabase.from('servicios').select('estado').eq('catalogo_id', c.id)
      setCatalogo({ version: c.version, servicios: s?.length ?? 0, sinTarifa: s?.filter((x) => x.estado !== 'listo').length ?? 0 })
    })()
  }, [negocio?.id])

  if (!negocio || !config) return null
  if (!esDueno) return (
    <div className="mx-auto max-w-xl p-8"><p className="flex items-center gap-2 rounded-lg bg-slate-100 p-4 text-sm text-slate-600"><Lock className="h-4 w-4" />Solo el dueño del negocio puede hacer la configuración inicial.</p></div>
  )

  const telValido = /^\+?57\s?3\d{2}\s?\d{3}\s?\d{4}$/.test(datos.telefono.trim())
  const puedeSeguir = [
    datos.nombre.trim().length > 1 && datos.ciudad.trim().length > 1,
    telValido,
    !!catalogo,
    asis.nombre.trim().length > 1,
  ][paso]

  const guardarYSeguir = async () => {
    setGuardando(true); setError(null)
    let r: { error: { message: string } | null } = { error: null }
    if (paso === 0) r = await supabase.from('negocios').update({ nombre: datos.nombre.trim(), sector: datos.sector.trim(), ciudad: datos.ciudad.trim() }).eq('id', negocio.id)
    if (paso === 1) r = await supabase.from('negocios').update({ telefono_whatsapp: datos.telefono.trim() }).eq('id', negocio.id)
    if (paso === 3) {
      const cambios: Partial<Configuracion> & { actualizado_en: string } = { nombre_asistente: asis.nombre.trim(), tono: asis.tono, activo: asis.activo, actualizado_en: new Date().toISOString() }
      if (asis.horario !== 'actual') cambios.horario_laboral = HORARIOS[asis.horario].h
      r = await supabase.from('configuracion_asistente').update(cambios).eq('negocio_id', negocio.id)
    }
    if (r.error) { setError('No se pudo guardar: ' + r.error.message); setGuardando(false); return }
    await recargarConfig()
    setGuardando(false)
    if (paso === 3) navegar('/simulador')
    else setPaso(paso + 1)
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Link to="/configuracion" className="text-xs text-indigo-600 hover:underline">← Configuración avanzada</Link>
      <h1 className="mt-2 text-2xl font-semibold">Configura tu asistente en 4 pasos</h1>
      <p className="text-sm text-slate-500">Unos 10 minutos. Puedes volver y cambiar cualquier dato cuando quieras.</p>

      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p.t}>
            <button type="button" onClick={() => i < paso && setPaso(i)} disabled={i > paso} aria-current={i === paso ? 'step' : undefined}
              className={clsx('w-full rounded-lg border-t-4 pt-2 text-left transition', i < paso ? 'border-exito' : i === paso ? 'border-indigo-600' : 'border-slate-200')}>
              <span className={clsx('flex items-center gap-1.5 text-xs font-semibold', i === paso ? 'text-indigo-700' : i < paso ? 'text-exito' : 'text-slate-400')}>
                {i < paso ? <Check className="h-3.5 w-3.5" aria-label="Completado" /> : <span>{i + 1}.</span>}{p.t}
              </span>
              <span className="hidden text-[11px] text-slate-500 sm:block">{p.d}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className="tarjeta mt-6 p-5 md:p-6" aria-live="polite">
        {paso === 0 && (
          <div className="grid gap-4">
            <h2 className="font-semibold">¿Cómo se llama tu negocio?</h2>
            <div><label className="etiqueta-campo" htmlFor="g-nombre">Nombre comercial</label>
              <input id="g-nombre" className="campo" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="etiqueta-campo" htmlFor="g-sector">Sector</label>
                <input id="g-sector" className="campo" placeholder="Ej.: Educación" value={datos.sector} onChange={(e) => setDatos({ ...datos, sector: e.target.value })} /></div>
              <div><label className="etiqueta-campo" htmlFor="g-ciudad">Ciudad</label>
                <input id="g-ciudad" className="campo" placeholder="Ej.: Bucaramanga" value={datos.ciudad} onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })} /></div>
            </div>
            <p className="text-xs text-slate-500">El nombre aparece en el saludo del asistente y en el encabezado de cada cotización en PDF.</p>
          </div>
        )}

        {paso === 1 && (
          <div className="grid gap-4">
            <h2 className="font-semibold">¿A qué número te escriben tus clientes?</h2>
            <div><label className="etiqueta-campo" htmlFor="g-tel">Número de WhatsApp Business</label>
              <div className="relative"><Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input id="g-tel" className="campo pl-9" inputMode="tel" placeholder="+57 300 123 4567" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} aria-invalid={!!datos.telefono && !telValido} /></div>
              {datos.telefono && !telValido && <p className="mt-1 text-xs text-urgente">Escribe un celular colombiano: +57 seguido de 10 dígitos que empiezan por 3.</p>}
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <strong>En este prototipo</strong> los mensajes llegan por el simulador de WhatsApp. En el piloto, este paso conecta el número con la API oficial de WhatsApp Business (Meta) mediante el registro integrado; el número debe estar verificado por Meta.
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="grid gap-4">
            <h2 className="font-semibold">Carga tu lista de precios</h2>
            <p className="text-sm text-slate-600">El asistente solo cotiza con los precios de tu catálogo activo. Sube tu Excel o CSV tal como lo tienes: el sistema reconoce las columnas y te muestra qué filas tienen problemas antes de activarlo.</p>
            {catalogo ? (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-exito" />
                <div><p className="font-medium text-green-900">Catálogo activo (versión {catalogo.version}) con {catalogo.servicios} servicios</p>
                  {catalogo.sinTarifa > 0 && <p className="text-xs text-green-800">{catalogo.sinTarifa} sin tarifa válida: esas consultas pasan a un asesor.</p>}
                  <Link to="/catalogo" className="mt-1 inline-block text-xs text-indigo-600 hover:underline">Cargar una versión nueva</Link></div>
              </div>
            ) : (
              <Link to="/catalogo" className="btn-primario w-fit"><FileSpreadsheet className="h-4 w-4" />Ir a cargar el catálogo</Link>
            )}
          </div>
        )}

        {paso === 3 && (
          <div className="grid gap-4">
            <h2 className="font-semibold">¿Cómo atiende tu asistente?</h2>
            <div><label className="etiqueta-campo" htmlFor="g-asis">Nombre con el que se presenta</label>
              <input id="g-asis" className="campo" value={asis.nombre} onChange={(e) => setAsis({ ...asis, nombre: e.target.value })} /></div>
            <fieldset><legend className="etiqueta-campo">Tono</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[['cercano', 'Cercano', '«¡Hola! Te cuento que la hora vale…»'], ['profesional', 'Profesional', '«Buenas tardes. Le informo que la hora tiene un valor de…»']].map(([v, t, ej]) => (
                  <label key={v} className={clsx('cursor-pointer rounded-lg border p-3 text-sm', asis.tono === v ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200')}>
                    <input type="radio" name="tono" className="sr-only" checked={asis.tono === v} onChange={() => setAsis({ ...asis, tono: v })} />
                    <span className="block font-medium">{t}</span><span className="text-xs text-slate-500">{ej}</span>
                  </label>
                ))}
              </div></fieldset>
            <div><label className="etiqueta-campo" htmlFor="g-horario">Horario de atención de tu equipo</label>
              <select id="g-horario" className="campo" value={asis.horario} onChange={(e) => setAsis({ ...asis, horario: e.target.value })}>
                <option value="actual">Mantener el horario actual</option>
                {Object.entries(HORARIOS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">El asistente responde las 24 horas; el horario sirve para medir cuántas consultas llegan cuando tu equipo no está.</p></div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium">Activar el asistente al terminar</span>
              <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={asis.activo} onChange={(e) => setAsis({ ...asis, activo: e.target.checked })} />
            </label>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <button className="btn-secundario" onClick={() => setPaso(paso - 1)} disabled={paso === 0 || guardando}><ArrowLeft className="h-4 w-4" />Atrás</button>
          <button className="btn-primario" onClick={guardarYSeguir} disabled={!puedeSeguir || guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {paso === 3 ? <>Terminar y probar<Rocket className="h-4 w-4" /></> : <>Guardar y seguir<ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </section>
    </div>
  )
}
