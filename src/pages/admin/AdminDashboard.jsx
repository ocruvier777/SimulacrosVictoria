import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [institutions, setInstitutions] = useState([])
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
      supabase.from('institutions').select(`
        id, name,
        programs(
          id,
          program_subjects(question_count),
          exams(
            id, status,
            questions(count)
          )
        )
      `).order('name'),
    ])

    results.forEach((r, i) => {
      if (r.error) console.error(`[AdminDashboard] Query ${i} error:`, r.error.message)
    })

    const [
      { count: institutionCount },
      { count: programCount },
      { count: questionCount },
      { count: studentCount },
      { data: instData },
    ] = results

    setStats({
      institutions: institutionCount || 0,
      programs: programCount || 0,
      questions: questionCount || 0,
      students: studentCount || 0,
    })

    setInstitutions(
      (instData || []).map((inst) => {
        const programs = inst.programs || []
        let draft = 0, available = 0, closed = 0, loaded = 0, required = 0

        programs.forEach((prog) => {
          const subjectTotal = (prog.program_subjects || []).reduce(
            (s, sub) => s + (sub.question_count || 0), 0
          )
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
          draft,
          available,
          closed,
          loaded,
          required,
          pct,
        }
      })
    )

    setLoading(false)
    } catch (err) {
      console.error('[AdminDashboard] Error loading data:', err)
      setStats({ institutions: 0, programs: 0, questions: 0, students: 0 })
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
    { label: 'Instituciones', value: stats.institutions, color: 'text-primary', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    )},
    { label: 'Carreras', value: stats.programs, color: 'text-accent', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    )},
    { label: 'Preguntas', value: stats.questions, color: 'text-info', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
    )},
    { label: 'Alumnos', value: stats.students, color: 'text-success', icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="flex items-center gap-4">
            <div className={card.color}>{card.icon}</div>
            <div>
              <p className="text-2xl font-display font-bold text-text-main">
                {card.value}
              </p>
              <p className="text-sm text-text-body">{card.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Institution summary table */}
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
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
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
                    <td className="px-4 py-3 text-center text-text-muted">{inst.draft}</td>
                    <td className="px-4 py-3 text-center text-success">{inst.available}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{inst.closed}</td>
                    <td className="px-4 py-3 text-center">
                      {inst.loaded}
                      {inst.required > 0 && (
                        <span className="text-text-muted"> / {inst.required}</span>
                      )}
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
