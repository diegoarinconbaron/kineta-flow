import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Marca'
import { Loader2, MessageCircle, FileText, BellRing } from 'lucide-react'

const CUENTAS = [
  { email: 'marcia@demo.kinetaflow.co', nombre: 'Marcia Rodríguez', rol: 'Dueña · Monitorías Teorema' },
  { email: 'laura@demo.kinetaflow.co', nombre: 'Laura Gómez', rol: 'Asesora · Monitorías Teorema' },
  { email: 'alejandro@demo.kinetaflow.co', nombre: 'Alejandro Castillo', rol: 'Dueño · Castillo Solar' },
  { email: 'camilo@demo.kinetaflow.co', nombre: 'Camilo Suárez', rol: 'Asesor · Castillo Solar' },
]
const CLAVE_DEMO = 'KinetaFlow2026'

export default function Login() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState<string | null>(null)

  const entrar = async (e: string, c: string) => {
    setError(''); setCargando(e)
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: c })
    if (error) setError('El correo o la contraseña no coinciden. Revisa e intenta de nuevo.')
    setCargando(null)
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-noche p-12 text-white lg:flex">
        <Logo claro />
        <div>
          <h1 className="text-4xl font-semibold leading-tight">Tu WhatsApp responde y cotiza<br />aunque tú estés descansando.</h1>
          <p className="mt-4 max-w-md text-slate-300">El asistente atiende con tus precios reales, envía la cotización en PDF y te pasa al cliente cuando está listo para comprar.</p>
          <ul className="mt-8 space-y-4 text-sm">
            {[[MessageCircle, 'Respuesta en segundos, las 24 horas'], [FileText, 'Cotiza solo con el catálogo que tú validaste'], [BellRing, 'Te avisa cuando un cliente necesita a una persona']].map(([I, t]) => {
              const Icono = I as typeof MessageCircle
              return <li key={t as string} className="flex items-center gap-3"><span className="rounded-lg bg-noche-700 p-2"><Icono className="h-4 w-4 text-indigo-200" /></span>{t as string}</li>
            })}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Proyecto final · From Ideas to Prototypes · Universidad del Rosario · 2026</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-semibold">Ingresa a tu panel</h2>
          <p className="mt-1 text-sm text-slate-500">Para la demostración, elige una de las cuentas de prueba.</p>

          <div className="mt-6 grid gap-2">
            {CUENTAS.map((c) => (
              <button key={c.email} onClick={() => entrar(c.email, CLAVE_DEMO)} disabled={!!cargando}
                className="tarjeta flex items-center justify-between px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40">
                <span><span className="block text-sm font-medium">{c.nombre}</span><span className="text-xs text-slate-500">{c.rol}</span></span>
                {cargando === c.email ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> : <span className="text-xs font-medium text-indigo-600">Entrar →</span>}
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />o con tu correo<span className="h-px flex-1 bg-slate-200" /></div>

          <form onSubmit={(e) => { e.preventDefault(); entrar(email, clave) }} className="space-y-3">
            <div><label htmlFor="email" className="etiqueta-campo">Correo</label><input id="email" type="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <div><label htmlFor="clave" className="etiqueta-campo">Contraseña</label><input id="clave" type="password" required className="campo" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" /></div>
            {error && <p role="alert" className="text-sm text-urgente">{error}</p>}
            <button className="btn-primario w-full" disabled={!!cargando}>Ingresar</button>
          </form>
          <p className="mt-4 text-xs text-slate-400">Contraseña de las cuentas de prueba: <code className="rounded bg-slate-100 px-1">{CLAVE_DEMO}</code></p>
        </div>
      </section>
    </div>
  )
}
