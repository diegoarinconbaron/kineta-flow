import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Filter, X, Search, Moon, ChevronRight } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { ESTADOS, haceCuanto, normalizar, pesos } from '../lib/formato'
import { Avatar, EtiquetaEstado } from '../components/Marca'
import type { Conversacion, EstadoLead } from '../lib/tipos'

const ORDEN: EstadoLead[] = ['nuevo', 'cotizado', 'listo_para_comprar', 'sin_respuesta', 'cerrado']

export default function Leads() {
  const { negocio } = useSesion()
  const navegar = useNavigate()
  const [leads, setLeads] = useState<Conversacion[]>([])
  const [aplicados, setAplicados] = useState<EstadoLead[]>([])
  const [borrador, setBorrador] = useState<EstadoLead[]>([])
  const [panel, setPanel] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [limite, setLimite] = useState(40)
  const refPanel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!negocio) return
    supabase.from('conversaciones').select('*, clientes(nombre, telefono, municipio)').eq('negocio_id', negocio.id)
      .order('ultimo_mensaje_en', { ascending: false }).limit(1000)
      .then(({ data }) => setLeads((data ?? []) as Conversacion[]))
  }, [negocio?.id])

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (refPanel.current && !refPanel.current.contains(e.target as Node)) setPanel(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const conteo = useMemo(() => Object.fromEntries(ORDEN.map((e) => [e, leads.filter((l) => l.estado_lead === e).length])) as Record<EstadoLead, number>, [leads])
  const visibles = leads.filter((l) => (aplicados.length === 0 || aplicados.includes(l.estado_lead)) &&
    (!busqueda || normalizar(`${l.clientes?.nombre} ${l.necesidad} ${l.clientes?.telefono}`).includes(normalizar(busqueda))))

  const abrirPanel = () => { setBorrador(aplicados); setPanel(!panel) }
  const aplicar = () => { setAplicados(borrador); setPanel(false); setLimite(40) }
  const quitar = (e: EstadoLead) => setAplicados(aplicados.filter((x) => x !== e))
  const soloEstado = (e: EstadoLead) => { setAplicados(aplicados.length === 1 && aplicados[0] === e ? [] : [e]); setLimite(40) }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <p className="text-sm text-slate-500">El asistente clasifica cada conversación según la intención de compra del cliente.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ORDEN.map((e) => (
          <button key={e} onClick={() => soloEstado(e)} aria-pressed={aplicados.length === 1 && aplicados[0] === e}
            className={clsx('tarjeta p-4 text-left transition hover:border-indigo-300', aplicados.length === 1 && aplicados[0] === e && 'ring-2 ring-indigo-600')}>
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className={clsx('h-2 w-2 rounded-full', ESTADOS[e].punto)} aria-hidden="true" />{ESTADOS[e].plural}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{conteo[e] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="tarjeta mt-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <div className="relative" ref={refPanel}>
            <button className={clsx('btn-secundario', aplicados.length && 'border-indigo-600 text-indigo-700')} onClick={abrirPanel} aria-expanded={panel}>
              <Filter className="h-4 w-4" />Filtros{aplicados.length > 0 && ` (${aplicados.length})`}
            </button>
            {panel && (
              <div className="absolute left-0 z-20 mt-2 w-64 tarjeta p-4" role="dialog" aria-label="Filtrar por estado">
                <div className="text-sm font-semibold">Estado del lead</div>
                <div className="mt-3 space-y-2">
                  {ORDEN.map((e) => (
                    <label key={e} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-indigo-600" checked={borrador.includes(e)}
                        onChange={() => setBorrador(borrador.includes(e) ? borrador.filter((x) => x !== e) : [...borrador, e])} />
                      <EtiquetaEstado estado={e} /><span className="ml-auto text-xs text-slate-400">{conteo[e]}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-between">
                  <button className="btn-fantasma px-2" onClick={() => setBorrador([])}>Limpiar</button>
                  <button className="btn-primario" onClick={aplicar}>Aplicar</button>
                </div>
              </div>
            )}
          </div>
          {aplicados.map((e) => (
            <span key={e} className={clsx('inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-medium ring-1 ring-inset', ESTADOS[e].clase)}>
              {ESTADOS[e].plural}
              <button onClick={() => quitar(e)} className="rounded-full p-0.5 hover:bg-black/10" aria-label={`Quitar filtro ${ESTADOS[e].plural}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input className="campo pl-9" placeholder="Buscar por nombre o necesidad" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar lead" />
          </label>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-500" aria-live="polite">
          Mostrando {visibles.length} {visibles.length === 1 ? 'lead' : 'leads'}
          {aplicados.length > 0 && <> con estado {aplicados.map((e) => `«${ESTADOS[e].etiqueta}»`).join(' o ')}</>}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200"><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Necesidad</th><th className="px-4 py-2 text-right">Valor cotizado</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2">Último mensaje</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.slice(0, limite).map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navegar(`/conversaciones?c=${l.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nombre={l.clientes?.nombre ?? '?'} className="h-8 w-8 text-[11px]" />
                      <div><div className="font-medium">{l.clientes?.nombre}</div><div className="text-xs text-slate-500">{l.clientes?.telefono}{l.clientes?.municipio && ` · ${l.clientes.municipio}`}</div></div>
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600"><div className="truncate">{l.necesidad}</div></td>
                  <td className="px-4 py-3 text-right tabular-nums">{pesos(l.valor_potencial)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <EtiquetaEstado estado={l.estado_lead} />
                      {l.requiere_asesor && <span className="rounded-full bg-urgente px-2 py-0.5 text-[11px] font-medium text-white">Pidió asesor</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">{l.fuera_de_horario && <Moon className="h-3 w-3 text-amber-600" aria-label="Fuera de horario" />}{haceCuanto(l.ultimo_mensaje_en)}</span>
                  </td>
                  <td className="px-2"><ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" /></td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">No hay leads con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {visibles.length > limite && (
          <div className="border-t border-slate-100 p-3 text-center"><button className="btn-fantasma" onClick={() => setLimite(limite + 40)}>Ver más ({visibles.length - limite} restantes)</button></div>
        )}
      </div>
    </div>
  )
}
