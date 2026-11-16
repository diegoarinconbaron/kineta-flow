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

function Rutas() {
  const { cargando, sesion, miembro } = useSesion()
  if (cargando) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label="Cargando" /></div>
  if (!sesion || !miembro) return <Login />
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
