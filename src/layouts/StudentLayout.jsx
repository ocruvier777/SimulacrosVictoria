import { Outlet } from 'react-router-dom'

// Layout del alumno: sidebar izquierdo con navegación + navbar superior
// Sidebar: Inicio, Mis Cursos/Simulacros, Mi Progreso, Pagos, Perfil
// Navbar: logo, campana de notificaciones, avatar, toggle rol
// TODO: implementar sidebar, navbar y contenido con Outlet
export default function StudentLayout() {
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
