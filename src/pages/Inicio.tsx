import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MessageSquare, Moon, FileText, Timer, ChevronRight, Info } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { haceCuanto } from '../lib/formato'
import { Avatar, EtiquetaEstado } from '../components/Marca'
import type { Conversacion } from '../lib/tipos'

interface Resumen {
  conversaciones: number; fuera_de_horario: number; cotizaciones: number; tiempo_respuesta_s: number
  serie: { dia: string; dentro: number; fuera: number }[]
}

const RANGOS = [{ v: 1, t: 'Hoy' }, { v: 7, t: 'Últimos 7 días' }, { v: 30, t: 'Últimos 30 días' }]

export default function Inicio() {
  const { negocio, miembro } = useSesion()
  const [dias, setDias] = useState(7)
  const [r, setR] = useState<Resumen | null>(null)
  const [atencion, setAtencion] = useState<(Conversacion & { motivo?: string })[]>([])

  useEffect(() => {
    if (!negocio) return
    supabase.rpc('resumen_negocio', { p_negocio: negocio.id, p_dias: dias }).then(({ data }) => setR(data as Resumen))
  }, [negocio?.id, dias])

  useEffect(() => {
    if (!negocio) return
    const cargar = () => supabase.from('conversaciones').select('*, clientes(nombre, telefono)')
      .eq('negocio_id', negocio.id).or('requiere_asesor.eq.true,estado_lead.eq.listo_para_comprar')
      .order('requiere_asesor', { ascending: false }).order('ultimo_mensaje_en', { ascending: false }).limit(6)
      .then(({ data }) => setAtencion((data ?? []) as Conversacion[]))
    cargar()
    const canal = supabase.channel('inicio-' + negocio.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones', filter: `negocio_id=eq.${negocio.id}` }, cargar).subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [negocio?.id])

  const horaBogota = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }))
  const saludo = horaBogota < 12 ? 'Buenos días' : horaBogota < 19 ? 'Buenas tardes' : 'Buenas noches'
  const pct = r && r.conversaciones ? Math.round((r.fuera_de_horario / r.conversaciones) * 100) : 0
  const serie = (r?.serie ?? []).map((d) => ({
    ...d, etiqueta: new Date(d.dia + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
  }))

  const tarjetas = [
    { icono: MessageSquare, titulo: 'Conversaciones atendidas', valor: r?.conversaciones, nota: 'por el asistente y tu equipo', color: 'text-indigo-600 bg-indigo-50' },
    { icono: Moon, titulo: 'Atendidas fuera de horario', valor: r?.fuera_de_horario, nota: `${pct} % del total, mientras nadie estaba conectado`, color: 'text-amber-700 bg-amber-50' },
    { icono: FileText, titulo: 'Cotizaciones enviadas', valor: r?.cotizaciones, nota: 'en PDF, con tu catálogo activo', color: 'text-emerald-700 bg-emerald-50' },
    { icono: Timer, titulo: 'Tiempo promedio de respuesta', valor: r ? `${r.tiempo_respuesta_s} s` : undefined, nota: 'desde el primer mensaje del cliente', color: 'text-sky-700 bg-sky-50' },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{saludo}, {miembro?.nombre.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">Esto es lo que atendió el asistente de {negocio?.nombre}.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Rango</span>
          <select className="campo w-44" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Rango de fechas">
            {RANGOS.map((x) => <option key={x.v} value={x.v}>{x.t}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map(({ icono: Icono, titulo, valor, nota, color }) => (
          <div key={titulo} className="tarjeta p-5">
            <div className="flex items-center gap-3">
              <span className={`rounded-lg p-2 ${color}`}><Icono className="h-4 w-4" aria-hidden="true" /></span>
              <span className="text-sm text-slate-600">{titulo}</span>
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{valor ?? '…'}</div>
            <div className="mt-1 text-xs text-slate-500">{nota}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="tarjeta p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Conversaciones por día</h2>
            <span className="text-xs text-slate-500">Dentro y fuera del horario laboral</span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval={dias > 7 ? 3 : 0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#EEF0FE' }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Bar dataKey="dentro" name="En horario laboral" stackId="a" fill="#4F46E5" radius={[0, 0, 4, 4]} />
                <Bar dataKey="fuera" name="Fuera de horario" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {r && r.fuera_de_horario > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {r.fuera_de_horario} conversaciones llegaron cuando el negocio estaba cerrado. Sin el asistente, esas personas habrían esperado hasta el siguiente día hábil.
            </p>
          )}
        </div>

        <div className="tarjeta p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Requieren tu atención</h2>
            <Link to="/conversaciones" className="text-xs font-medium text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {atencion.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Todo al día. Nadie está esperando.</li>}
            {atencion.map((c) => (
              <li key={c.id}>
                <Link to={`/conversaciones?c=${c.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                  <Avatar nombre={c.clientes?.nombre ?? '?'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.clientes?.nombre}</div>
                    <div className="truncate text-xs text-slate-500">{c.necesidad}</div>
                    <div className="mt-1 flex items-center gap-2">
                      {c.requiere_asesor
                        ? <span className="rounded-full bg-urgente px-2 py-0.5 text-[11px] font-medium text-white">Pidió un asesor</span>
                        : <EtiquetaEstado estado={c.estado_lead} />}
                      <span className="text-[11px] text-slate-400">{haceCuanto(c.ultimo_mensaje_en)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
