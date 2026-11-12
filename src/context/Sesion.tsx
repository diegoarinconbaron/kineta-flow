import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const usuarioActual = useRef<string | null>(null)

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setMiembro(null); setNegocio(null); setConfig(null); setCargando(false); return }
    // el canal de tiempo real debe usar el token del usuario para que las políticas por negocio dejen pasar los eventos
    supabase.realtime.setAuth(s.access_token)
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
    supabase.auth.getSession().then(({ data }) => {
      usuarioActual.current = data.session?.user.id ?? null
      setSesion(data.session); cargarPerfil(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s)
      // recargar el perfil solo cuando cambia el usuario (no en cada renovación de token o cambio de pestaña)
      const id = s?.user.id ?? null
      if (evento !== 'INITIAL_SESSION' && id !== usuarioActual.current) {
        usuarioActual.current = id
        setCargando(true)
        setTimeout(() => cargarPerfil(s), 0)
      }
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
