import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthProvider from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import StudentLayout from './layouts/StudentLayout'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Pricing from './pages/Pricing'
import Dashboard from './pages/student/Dashboard'
import ExamView from './pages/student/ExamView'
import Results from './pages/student/Results'
import Review from './pages/student/Review'
import AdminDashboard from './pages/admin/AdminDashboard'
import Institutions from './pages/admin/Institutions'
import InstitutionPrograms from './pages/admin/InstitutionPrograms'
import ProgramSubjects from './pages/admin/ProgramSubjects'
import Exams from './pages/admin/Exams'
import Questions from './pages/admin/Questions'
import AdminPlaceholder from './pages/admin/AdminPlaceholder'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* Rutas protegidas del alumno */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<StudentLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/exam/:examId" element={<ExamView />} />
                <Route path="/results/:sessionId" element={<Results />} />
                <Route path="/review/:sessionId" element={<Review />} />
              </Route>
            </Route>

            {/* Rutas protegidas del admin */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="institutions" element={<Institutions />} />
                <Route path="institutions/:institutionId/programs" element={<InstitutionPrograms />} />
                <Route path="institutions/:institutionId/programs/:programId/subjects" element={<ProgramSubjects />} />
                <Route path="exams" element={<Exams />} />
                <Route path="questions" element={<Questions />} />
                <Route path="readings" element={<AdminPlaceholder title="Lecturas" />} />
                <Route path="audios" element={<AdminPlaceholder title="Audios" />} />
                <Route path="students" element={<AdminPlaceholder title="Alumnos" />} />
                <Route path="settings" element={<AdminPlaceholder title="Configuración" />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
