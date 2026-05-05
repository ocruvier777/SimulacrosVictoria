import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = {
  primary: '#2B4BA0',
  accent: '#F5841F',
  success: '#2ECC71',
  warning: '#F1C40F',
  danger: '#E74C3C',
  info: '#3498DB',
}

const paymentLabels = {
  free_trial: 'Free Trial',
  pending: 'Pendiente',
  paid: 'Pagado',
}
const paymentColors = {
  free_trial: COLORS.info,
  pending: COLORS.warning,
  paid: COLORS.success,
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [institutions, setInstitutions] = useState([])
  const [chartStudentsByInst, setChartStudentsByInst] = useState([])
  const [chartPayments, setChartPayments] = useState([])
  const [chartRegistrations, setChartRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const results = await Promise.all([
        supabase.from('institutions').select('*', { count: 'exact', head: true }),
        supabase.from('programs').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        // Datos para la tabla de instituciones con alumnos
        supabase.from('institutions').select(`
          id, name,
          programs(
            id, institution_id,
            program_subjects(question_count),
            exams(id, status, questions(count)),
            user_programs(count)
          )
        `).order('name'),
        // Datos de pagos por estado
        supabase.from('user_programs').select('payment_status'),
        // Registros últimos 30 días
        supabase.from('profiles').select('created_at').eq('role', 'student'),
      ])

      results.forEach((r, i) => {
        if (r.error) console.error(`[AdminDashboard] Query ${i} error:`, r.error.message)
      })

      const [
        { count: institutionCount },
        { count: programCount },
        { count: questionCount },
        { count: studentCount },
        { count: examAvailableCount },
        { count: paymentApprovedCount },
        { data: instData },
        { data: upData },
        { data: profileData },
      ] = results

      setStats({
        institutions: institutionCount || 0,
        programs: programCount || 0,
        questions: questionCount || 0,
        students: studentCount || 0,
        examsAvailable: examAvailableCount || 0,
        paymentsApproved: paymentApprovedCount || 0,
      })

      // Tabla de instituciones + gráfica de barras
      const instRows = (instData || []).map((inst) => {
        const programs = inst.programs || []
        let draft = 0, available = 0, closed = 0, loaded = 0, required = 0, studentTotal = 0

        programs.forEach((prog) => {
          const subjectTotal = (prog.program_subjects || []).reduce(
            (s, sub) => s + (sub.question_count || 0), 0
          )
          studentTotal += prog.user_programs?.[0]?.count || 0
          ;(prog.exams || []).forEach((exam) => {
            if (exam.status === 'draft') draft++
            else if (exam.status === 'available') available++
            else closed++
            loaded += exam.questions?.[0]?.count || 0
            required += subjectTotal
          })
        })

        const pct = required > 0 ? Math.round((loaded / required) * 100) : 0

        return {
          id: inst.id,
          name: inst.name,
          programCount: programs.length,
          draft, available, closed,
          loaded, required, pct,
          studentCount: studentTotal,
        }
      })
      setInstitutions(instRows)
      setChartStudentsByInst(
        instRows
          .filter((i) => i.studentCount > 0)
          .map((i) => ({ name: i.name, alumnos: i.studentCount }))
      )

      // Gráfica de pie: pagos
      const paymentCounts = { free_trial: 0, pending: 0, paid: 0 }
      ;(upData || []).forEach((up) => {
        if (paymentCounts[up.payment_status] !== undefined) {
          paymentCounts[up.payment_status]++
        }
      })
      const pieData = Object.entries(paymentCounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: paymentLabels[k], value: v, key: k }))
      setChartPayments(pieData)

      // Gráfica de línea: registros últimos 30 días
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const dayMap = {}
      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        dayMap[d.toISOString().slice(0, 10)] = 0
      }
      ;(profileData || []).forEach((p) => {
        const day = p.created_at?.slice(0, 10)
        if (day && dayMap[day] !== undefined) {
          dayMap[day]++
        }
      })
      setChartRegistrations(
        Object.entries(dayMap).map(([date, count]) => ({
          date: date.slice(5),
          registros: count,
        }))
      )

      setLoading(false)
    } catch (err) {
      console.error('[AdminDashboard] Error loading data:', err)
      setStats({ institutions: 0, programs: 0, questions: 0, students: 0, examsAvailable: 0, paymentsApproved: 0 })
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const summaryCards = [
    { label: 'Instituciones', value: stats.institutions, color: 'text-primary', link: '/admin/institutions', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    )},
    { label: 'Carreras', value: stats.programs, color: 'text-accent', link: '/admin/institutions', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    )},
    { label: 'Preguntas', value: stats.questions, color: 'text-info', link: '/admin/questions', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
    )},
    { label: 'Alumnos', value: stats.students, color: 'text-success', link: '/admin/students', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    )},
    { label: 'Exámenes disponibles', value: stats.examsAvailable, color: 'text-warning', link: '/admin/exams', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    )},
    { label: 'Pagos aprobados', value: stats.paymentsApproved, color: 'text-danger', link: '/admin/students', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    )},
  ]

  const semaphore = (pct) => {
    if (pct >= 100) return 'bg-success'
    if (pct >= 50) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-2xl font-bold text-text-main">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <Link key={card.label} to={card.link}>
            <Card className="flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className={card.color}>{card.icon}</div>
              <div>
                <p className="text-2xl font-display font-bold text-text-main">
                  {card.value}
                </p>
                <p className="text-sm text-text-body">{card.label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Barras: Alumnos por institución */}
        <Card>
          <h3 className="font-display font-semibold text-text-main mb-4">Alumnos por institución</h3>
          {chartStudentsByInst.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartStudentsByInst} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="alumnos" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie: Estados de pago */}
        <Card>
          <h3 className="font-display font-semibold text-text-main mb-4">Estados de pago</h3>
          {chartPayments.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartPayments}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartPayments.map((entry) => (
                    <Cell key={entry.key} fill={paymentColors[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Línea: Registros últimos 30 días */}
      <Card>
        <h3 className="font-display font-semibold text-text-main mb-4">Registros de alumnos (últimos 30 días)</h3>
        {chartRegistrations.every((d) => d.registros === 0) ? (
          <p className="text-sm text-text-muted py-8 text-center">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartRegistrations} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="registros"
                stroke={COLORS.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla de instituciones */}
      <Card className="overflow-hidden !p-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-display font-semibold text-text-main">
            Resumen por institución
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-text-body">
                <th className="px-4 py-3 font-medium">Institución</th>
                <th className="px-4 py-3 font-medium text-center">Carreras</th>
                <th className="px-4 py-3 font-medium text-center">Alumnos</th>
                <th className="px-4 py-3 font-medium text-center">Borrador</th>
                <th className="px-4 py-3 font-medium text-center">Disponibles</th>
                <th className="px-4 py-3 font-medium text-center">Cerrados</th>
                <th className="px-4 py-3 font-medium text-center">Preguntas</th>
                <th className="px-4 py-3 font-medium text-center">Completitud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {institutions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                    No hay instituciones registradas.{' '}
                    <Link to="/admin/institutions" className="text-primary hover:underline">
                      Crear una
                    </Link>
                  </td>
                </tr>
              ) : (
                institutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-text-main">
                      <Link
                        to={`/admin/institutions/${inst.id}/programs`}
                        className="hover:text-primary transition-colors"
                      >
                        {inst.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">{inst.programCount}</td>
                    <td className="px-4 py-3 text-center">
                      <Link to="/admin/students" className="hover:text-primary transition-colors">
                        {inst.studentCount}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-text-muted">{inst.draft}</td>
                    <td className="px-4 py-3 text-center text-success">{inst.available}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{inst.closed}</td>
                    <td className="px-4 py-3 text-center">
                      <Link to="/admin/questions" className="hover:text-primary transition-colors">
                        {inst.loaded}
                        {inst.required > 0 && (
                          <span className="text-text-muted"> / {inst.required}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${semaphore(inst.pct)}`}
                            style={{ width: `${Math.min(inst.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted w-10 text-right">
                          {inst.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
