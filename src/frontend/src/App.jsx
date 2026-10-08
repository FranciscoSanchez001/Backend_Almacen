import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './layouts/Layout'
import TiendaLayout from './layouts/TiendaLayout'
import PanelLayout from './layouts/PanelLayout'
import RutaProtegida from './routes/RutaProtegida'
import Catalogo from './pages/tienda/Catalogo'
import LoginInterno from './pages/auth/LoginInterno'
import NoEncontrada from './pages/NoEncontrada'

// Las pantallas del personal se descargan solo cuando se abren: así la tienda
// no carga los gráficos del dashboard ni el resto del panel.
const Resumen = lazy(() => import('./pages/panel/Resumen'))
const Pedidos = lazy(() => import('./pages/panel/Pedidos'))
const Productos = lazy(() => import('./pages/panel/Productos'))
const Inventario = lazy(() => import('./pages/panel/Inventario'))
const Clientes = lazy(() => import('./pages/panel/Clientes'))
const PowerBIDashboard = lazy(() => import('./pages/admin/PowerBIDashboard'))
const Personal = lazy(() => import('./pages/admin/Personal'))
const Auditoria = lazy(() => import('./pages/admin/Auditoria'))
const Configuracion = lazy(() => import('./pages/admin/Configuracion'))
const RepartidorInicio = lazy(() => import('./pages/repartidor/Inicio'))

// Las 4 áreas del sistema (ver especificación). Cada área del personal está
// protegida por rol (RutaProtegida); la API vuelve a validar el rol en cada endpoint.
// El gerente (superadmin) tiene todo lo del panel de ventas, más la administración.
function App() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Routes>
        {/* Tienda (cliente) → / */}
        <Route element={<TiendaLayout />}>
          <Route index element={<Catalogo />} />
        </Route>

        {/* Panel del personal: ventas → /panel, gerente → /panel y /admin */}
        <Route
          element={
            <RutaProtegida roles={['ventas', 'superadmin']}>
              <PanelLayout />
            </RutaProtegida>
          }
        >
          <Route path="/panel">
            <Route index element={<Resumen />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="productos" element={<Productos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="clientes" element={<Clientes />} />
          </Route>

          <Route path="/admin" element={<RutaProtegida roles={['superadmin']} />}>
            <Route index element={<PowerBIDashboard />} />
            <Route path="personal" element={<Personal />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Route>

        {/* Entregas (repartidor) → /repartidor. Todavía sin construir. */}
        <Route
          path="/repartidor"
          element={
            <RutaProtegida roles={['repartidor', 'superadmin']}>
              <Layout titulo="Entregas" acento="text-orange-700 dark:text-orange-300" perfil />
            </RutaProtegida>
          }
        >
          <Route index element={<RepartidorInicio />} />
        </Route>

        {/* Acceso interno del personal → /internal-login (solo correo y contraseña) */}
        <Route path="/internal-login" element={<LoginInterno />} />

        {/* Cualquier otra ruta */}
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </Suspense>
  )
}

export default App
