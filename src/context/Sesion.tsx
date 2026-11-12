import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Configuracion, Miembro, Negocio } from '../lib/tipos'

interface ValorSesion {
  cargando: boolean
  sesion: Session | null
  miembro: Miembro | null
  negocio: Negocio | null
  config: Configuracion | null
  esDueno: boolean
  recargarConfig: () => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<ValorSesion>(null as unknown as ValorSesion)
export const useSesion = () => useContext(Ctx)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [miembro, setMiembro] = useState<Miembro | null>(null)
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [config, setConfig] = useState<Configuracion | null>(null)

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setMiembro(null); setNegocio(null); setConfig(null); setCargando(false); return }
    const { data: m } = await supabase.from('miembros_negocio').select('*').eq('usuario_id', s.user.id).limit(1).single()
    if (m) {
      setMiembro(m as Miembro)
      const [{ data: n }, { data: c }] = await Promise.all([
        supabase.from('negocios').select('*').eq('id', m.negocio_id).single(),
        supabase.from('configuracion_asistente').select('*').eq('negocio_id', m.negocio_id).single(),
      ])
      setNegocio(n as Negocio)
      setConfig(c as Configuracion)
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); cargarPerfil(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s)
      setCargando(true)
      setTimeout(() => cargarPerfil(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  const recargarConfig = async () => {
    if (!miembro) return
    const { data } = await supabase.from('configuracion_asistente').select('*').eq('negocio_id', miembro.negocio_id).single()
    setConfig(data as Configuracion)
  }

  const salir = async () => { await supabase.auth.signOut() }

  return (
    <Ctx.Provider value={{ cargando, sesion, miembro, negocio, config, esDueno: miembro?.rol === 'dueno', recargarConfig, salir }}>
      {children}
    </Ctx.Provider>
  )
}
