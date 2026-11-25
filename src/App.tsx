import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ProveedorSesion, useSesion } from './context/Sesion'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Catalogo from './pages/Catalogo'
import Leads from './pages/Leads'
import Conversaciones from './pages/Conversaciones'
import Configuracion from './pages/Configuracion'
import ConfiguracionGuiada from './pages/ConfiguracionGuiada'
import Simulador from './pages/Simulador'

/** Cuenta válida que no pertenece a ningún negocio (por ejemplo, creada fuera de la app) */
function SinNegocio() {
  const { salir, sesion } = useSesion()
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="tarjeta max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Tu cuenta aún no tiene un negocio</h1>
        <p className="mt-2 text-sm text-slate-600">{sesion?.user.email} inició sesión, pero no está asociada a ningún negocio en Kineta Flow. En el piloto, un asesor de Kineta Lab crea el negocio contigo. Para ver la demostración, entra con una de las cuentas de prueba.</p>
        <button className="btn-primario mx-auto mt-4" onClick={salir}>Volver a las cuentas de prueba</button>
      </div>
    </div>
  )
}

function Rutas() {
  const { cargando, sesion, miembro } = useSesion()
  if (cargando) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label="Cargando" /></div>
  if (!sesion) return <Login />
  if (!miembro) return <SinNegocio />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="conversaciones" element={<Conversaciones />} />
        <Route path="leads" element={<Leads />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="configuracion/guiada" element={<ConfiguracionGuiada />} />
        <Route path="simulador" element={<Simulador />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter><Rutas /></BrowserRouter>
    </ProveedorSesion>
  )
}
