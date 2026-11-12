import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, Home, MessageSquare, Users, FileSpreadsheet, Settings, Smartphone, LogOut, X } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { haceCuanto } from '../lib/formato'
import { Avatar, BannerDemo, Logo } from './Marca'

interface Notif { id: string; titulo: string; conversacion_id: string | null; leida: boolean; creada_en: string; tipo: string }

export default function Layout() {
  const { negocio, miembro, config, salir } = useSesion()
  const navegar = useNavigate()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [abierto, setAbierto] = useState(false)
  const [toast, setToast] = useState<Notif | null>(null)
  const [pendientes, setPendientes] = useState(0)
  const panel = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    if (!negocio) return
    const [{ data }, { count }] = await Promise.all([
      supabase.from('notificaciones').select('*').eq('negocio_id', negocio.id).order('creada_en', { ascending: false }).limit(12),
      supabase.from('conversaciones').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).eq('requiere_asesor', true),
    ])
    setNotifs((data ?? []) as Notif[])
    setPendientes(count ?? 0)
  }

  useEffect(() => {
    if (!negocio) return
    cargar()
    const canal = supabase.channel('notif-' + negocio.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `negocio_id=eq.${negocio.id}` }, (p) => {
        setToast(p.new as Notif)
        setTimeout(() => setToast(null), 7000)
        cargar()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones', filter: `negocio_id=eq.${negocio.id}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [negocio?.id])

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const sinLeer = notifs.filter((n) => !n.leida).length

  const abrirNotif = async (n: Notif) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id)
    setAbierto(false); setToast(null)
    if (n.conversacion_id) navegar(`/conversaciones?c=${n.conversacion_id}`)
    cargar()
  }

  const items = [
    { a: '/', icono: Home, texto: 'Inicio' },
    { a: '/conversaciones', icono: MessageSquare, texto: 'Conversaciones', insignia: pendientes },
    { a: '/leads', icono: Users, texto: 'Leads' },
    { a: '/catalogo', icono: FileSpreadsheet, texto: 'Catálogo y precios' },
    { a: '/configuracion', icono: Settings, texto: 'Configuración' },
  ]

  return (
    <div className="flex h-full flex-col">
      <BannerDemo />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col bg-noche text-slate-300 md:flex">
          <div className="px-5 pt-5 pb-4"><Logo claro /></div>
          <div className="mx-4 mb-4 rounded-lg bg-noche-800 px-3 py-2.5">
            <div className="text-sm font-medium text-white">{negocio?.nombre}</div>
            <div className="text-xs text-slate-400">{negocio?.sector} · {negocio?.ciudad}</div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3" aria-label="Principal">
            {items.map(({ a, icono: Icono, texto, insignia }) => (
              <NavLink key={a} to={a} end={a === '/'}
                className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-indigo-600 text-white' : 'hover:bg-noche-700 hover:text-white')}>
                <Icono className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">{texto}</span>
                {!!insignia && <span className="rounded-full bg-urgente px-1.5 text-[11px] font-semibold text-white" aria-label={`${insignia} requieren asesor`}>{insignia}</span>}
              </NavLink>
            ))}
            <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-widest text-slate-500">Demostración</div>
            <NavLink to="/simulador" className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
              isActive ? 'bg-indigo-600 text-white' : 'hover:bg-noche-700 hover:text-white')}>
              <Smartphone className="h-4 w-4" aria-hidden="true" /> Simulador WhatsApp
            </NavLink>
          </nav>
          <div className="m-4 rounded-lg border border-noche-600 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-white">
              <span className={clsx('h-2.5 w-2.5 rounded-full', config?.activo ? 'bg-exito' : 'bg-slate-500')} aria-hidden="true" />
              {config?.activo ? 'Asistente activo' : 'Asistente en pausa'}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{config?.activo ? 'Respondiendo 24/7 con el catálogo vigente' : 'Las conversaciones esperan a tu equipo'}</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
            <div className="mr-auto md:hidden"><Logo /></div>
            <div className="relative" ref={panel}>
              <button className="btn-fantasma relative px-2.5" onClick={() => setAbierto(!abierto)} aria-label={`Notificaciones, ${sinLeer} sin leer`}>
                <Bell className="h-5 w-5" />
                {sinLeer > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgente px-1 text-[10px] font-semibold text-white">{sinLeer}</span>}
              </button>
              {abierto && (
                <div className="absolute right-0 z-30 mt-2 w-80 tarjeta p-1">
                  <div className="px-3 py-2 text-sm font-semibold">Notificaciones</div>
                  {notifs.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">Sin notificaciones</div>}
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => abrirNotif(n)} className={clsx('flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50', !n.leida && 'bg-red-50/60')}>
                      <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.leida ? 'bg-slate-300' : 'bg-urgente')} aria-hidden="true" />
                      <span className="flex-1"><span className="block font-medium">{n.titulo}</span><span className="text-xs text-slate-500">{haceCuanto(n.creada_en)}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Avatar nombre={miembro?.nombre ?? '?'} className="h-8 w-8 text-xs" />
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium">{miembro?.nombre}</div>
                <div className="text-xs text-slate-500">{miembro?.rol === 'dueno' ? 'Dueño' : 'Asesor'}</div>
              </div>
            </div>
            <button className="btn-fantasma px-2.5" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 md:hidden" aria-label="Principal móvil">
            {[...items, { a: '/simulador', icono: Smartphone, texto: 'Simulador' }].map(({ a, texto }) => (
              <NavLink key={a} to={a} end={a === '/'} className={({ isActive }) => clsx('whitespace-nowrap rounded-md px-3 py-1.5 text-xs', isActive ? 'bg-indigo-600 text-white' : 'text-slate-600')}>{texto}</NavLink>
            ))}
          </nav>
          <main className="min-h-0 flex-1 overflow-y-auto"><Outlet /></main>
        </div>
      </div>

      {toast && (
        <div role="alert" className="fixed bottom-5 right-5 z-50 w-80 rounded-xl border-l-4 border-urgente bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 text-urgente" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{toast.titulo}</div>
              <div className="text-xs text-slate-500">El asistente pasó la conversación a tu equipo.</div>
              <button className="btn-urgente mt-2 px-3 py-1.5 text-xs" onClick={() => abrirNotif(toast)}>Ver conversación</button>
            </div>
            <button onClick={() => setToast(null)} aria-label="Cerrar alerta" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
