import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthProvider from './contexts/AuthContext'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Rutas del alumno */}
          <Route path="/" element={<StudentLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="exam/:examId" element={<ExamView />} />
            <Route path="results/:sessionId" element={<Results />} />
            <Route path="review/:sessionId" element={<Review />} />
          </Route>

          {/* Rutas del admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
