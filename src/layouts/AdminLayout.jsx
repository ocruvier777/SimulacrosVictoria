import { Outlet } from 'react-router-dom'

// Layout del admin: sidebar izquierdo con navegación + navbar superior
// Sidebar: Dashboard, Instituciones, Exámenes, Preguntas, Alumnos, Config
// TODO: implementar sidebar, navbar y contenido con Outlet
export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* TODO: Navbar */}
      <div className="flex">
        {/* TODO: Sidebar */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
