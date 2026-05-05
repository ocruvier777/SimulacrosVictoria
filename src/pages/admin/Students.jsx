import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'

const PAGE_SIZE = 20

const paymentConfig = {
  free_trial: { label: 'Free Trial', cls: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
}

const sessionStatusConfig = {
  completed: { label: 'Completado', cls: 'text-success' },
  abandoned: { label: 'Abandonado', cls: 'text-danger' },
  in_progress: { label: 'En progreso', cls: 'text-warning' },
}

const paymentProviderLabels = {
  mercadopago: 'Mercado Pago',
  manual: 'Manual',
  free: 'Gratis',
}

const paymentStatusConfig = {
  pending: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Aprobado', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  refunded: { label: 'Reembolsado', cls: 'bg-gray-100 text-gray-700' },
}

function scoreColor(score) {
  if (score >= 70) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-danger'
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Students() {
  const toast = useToast()

  const [institutions, setInstitutions] = useState([])
  const [programs, setPrograms] = useState([])
  const [filterInst, setFilterInst] = useState('')
  const [filterProg, setFilterProg] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [search, setSearch] = useState('')

  const [students, setStudents] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  // Modal detalle
  const [detailStudent, setDetailStudent] = useState(null)
  const [detailSessions, setDetailSessions] = useState([])
  const [detailPayments, setDetailPayments] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Modal cambiar pago
  const [paymentModal, setPaymentModal] = useState(null)
  const [newPaymentStatus, setNewPaymentStatus] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => {
    supabase
      .from('institutions')
      .select('id, name')
      .order('name')
      .then(({ data }) => setInstitutions(data || []))
  }, [])

  useEffect(() => {
    if (!filterInst) {
      setPrograms([])
      setFilterProg('')
      return
    }
    supabase
      .from('programs')
      .select('id, name, code')
      .eq('institution_id', filterInst)
      .order('name')
      .then(({ data }) => {
        setPrograms(data || [])
        setFilterProg('')
      })
  }, [filterInst])

  const loadStudents = useCallback(async () => {
    setLoading(true)

    // Traer perfiles con su user_programs
    let query = supabase
      .from('profiles')
      .select(`
        *,
        user_programs(
          id, payment_status,
          programs(id, name, code, institution_id, institutions(id, name))
        )
      `, { count: 'exact' })
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
    }

    const from = page * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (error) {
      toast('Error al cargar alumnos', 'error')
      setLoading(false)
      return
    }

    let filtered = data || []

    // Filtro por institución y carrera a nivel client (join complejo)
    if (filterInst) {
      filtered = filtered.filter((s) =>
        (s.user_programs || []).some((up) => up.programs?.institution_id === filterInst)
      )
    }
    if (filterProg) {
      filtered = filtered.filter((s) =>
        (s.user_programs || []).some((up) => up.programs?.id === filterProg)
      )
    }
    if (filterPayment) {
      filtered = filtered.filter((s) =>
        (s.user_programs || []).some((up) => up.payment_status === filterPayment)
      )
    }

    setStudents(filtered)
    setTotalCount(filterInst || filterProg || filterPayment ? filtered.length : (count || 0))
    setLoading(false)
  }, [search, page, filterInst, filterProg, filterPayment, toast])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    setPage(0)
  }, [search, filterInst, filterProg, filterPayment])

  // --- Detalle del alumno ---
  const openDetail = async (student) => {
    setDetailStudent(student)
    setDetailLoading(true)
    setDetailSessions([])
    setDetailPayments([])

    const [{ data: sessions }, { data: payments }] = await Promise.all([
      supabase
        .from('exam_sessions')
        .select('*, exams(exam_number, programs(name, code))')
        .eq('user_id', student.id)
        .order('started_at', { ascending: false }),
      supabase
        .from('payments')
        .select('*, programs(name, code)')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false }),
    ])

    setDetailSessions(sessions || [])
    setDetailPayments(payments || [])
    setDetailLoading(false)
  }

  // --- Cambiar estado de pago ---
  const openPaymentModal = (student) => {
    const up = (student.user_programs || [])[0]
    setPaymentModal(student)
    setNewPaymentStatus(up?.payment_status || 'free_trial')
  }

  const handlePaymentChange = async () => {
    if (!paymentModal) return
    setPaymentSaving(true)

    const up = (paymentModal.user_programs || [])[0]
    if (!up) {
      toast('El alumno no tiene carrera inscrita', 'error')
      setPaymentSaving(false)
      return
    }

    // Actualizar user_programs
    const { error: upError } = await supabase
      .from('user_programs')
      .update({ payment_status: newPaymentStatus })
      .eq('id', up.id)

    if (upError) {
      toast('Error: ' + upError.message, 'error')
      setPaymentSaving(false)
      return
    }

    // Si se cambia a 'paid', crear registro de pago manual
    if (newPaymentStatus === 'paid') {
      await supabase.from('payments').insert({
        user_id: paymentModal.id,
        program_id: up.programs.id,
        amount: 0,
        provider: 'manual',
        status: 'approved',
        provider_reference: 'Pago manual por admin',
      })
    }

    toast('Estado de pago actualizado', 'success')
    setPaymentSaving(false)
    setPaymentModal(null)
    loadStudents()
  }

  // Registrar pago manual desde el detalle
  const handleManualPayment = async () => {
    if (!detailStudent) return
    const up = (detailStudent.user_programs || [])[0]
    if (!up) {
      toast('El alumno no tiene carrera inscrita', 'error')
      return
    }

    const { error: payErr } = await supabase.from('payments').insert({
      user_id: detailStudent.id,
      program_id: up.programs.id,
      amount: 0,
      provider: 'manual',
      status: 'approved',
      provider_reference: 'Pago manual por admin',
    })

    if (payErr) {
      toast('Error: ' + payErr.message, 'error')
      return
    }

    await supabase
      .from('user_programs')
      .update({ payment_status: 'paid' })
      .eq('id', up.id)

    toast('Pago manual registrado', 'success')
    openDetail(detailStudent)
    loadStudents()
  }

  const initials = (name) =>
    (name || '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-2xl font-bold text-text-main">Alumnos</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-[220px]"
        />
        <select
          value={filterInst}
          onChange={(e) => { setFilterInst(e.target.value); setFilterProg('') }}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Todas las instituciones</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select
          value={filterProg}
          onChange={(e) => setFilterProg(e.target.value)}
          disabled={!filterInst}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        >
          <option value="">Todas las carreras</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Todos los pagos</option>
          <option value="free_trial">Free Trial</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-text-body">
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Carrera</th>
                  <th className="px-4 py-3 font-medium text-center">Pago</th>
                  <th className="px-4 py-3 font-medium text-center">Registro</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      No hay alumnos{search || filterInst || filterPayment ? ' con estos filtros' : ''}.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => {
                    const up = (s.user_programs || [])[0]
                    const prog = up?.programs
                    const inst = prog?.institutions
                    const pay = paymentConfig[up?.payment_status] || paymentConfig.free_trial

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <button onClick={() => openDetail(s)} className="flex items-center gap-3 hover:text-primary transition-colors text-left">
                            {s.avatar_url ? (
                              <img src={s.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {initials(s.name)}
                              </div>
                            )}
                            <span className="font-medium text-text-main">{s.name || 'Sin nombre'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-text-body">{s.email}</td>
                        <td className="px-4 py-3 text-text-body">{s.phone || '—'}</td>
                        <td className="px-4 py-3">
                          {prog ? (
                            <span className="text-text-main text-xs">
                              {prog.code} — {prog.name}
                              {inst && <span className="text-text-muted"> ({inst.name})</span>}
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">Sin carrera</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${pay.cls}`}>
                            {pay.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-text-muted text-xs">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openDetail(s)} className="text-text-muted hover:text-primary transition-colors" title="Ver detalle">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            </button>
                            <button onClick={() => openPaymentModal(s)} className="text-text-muted hover:text-accent transition-colors" title="Cambiar pago">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-text-muted">
                {totalCount} alumno{totalCount !== 1 ? 's' : ''} — Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded text-xs border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded text-xs border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ======== Modal detalle de alumno ======== */}
      <Modal
        open={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        title={`Detalle — ${detailStudent?.name || 'Alumno'}`}
        size="3xl"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : detailStudent && (
          <div className="space-y-6">
            {/* Sección 1: Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted">Nombre</p>
                <p className="font-medium text-text-main">{detailStudent.name || 'Sin nombre'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Email</p>
                <p className="font-medium text-text-main">{detailStudent.email}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Teléfono</p>
                <p className="font-medium text-text-main">{detailStudent.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Registro</p>
                <p className="font-medium text-text-main">{new Date(detailStudent.created_at).toLocaleDateString()}</p>
              </div>
              {(() => {
                const up = (detailStudent.user_programs || [])[0]
                const prog = up?.programs
                const inst = prog?.institutions
                const pay = paymentConfig[up?.payment_status] || paymentConfig.free_trial
                return (
                  <>
                    <div>
                      <p className="text-xs text-text-muted">Carrera</p>
                      {prog ? (
                        <Link
                          to={`/admin/institutions/${inst?.id}/programs`}
                          className="font-medium text-primary hover:underline"
                        >
                          {prog.code} — {prog.name} ({inst?.name})
                        </Link>
                      ) : (
                        <p className="text-text-muted">Sin carrera</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Estado de pago</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${pay.cls}`}>
                          {pay.label}
                        </span>
                        <button
                          onClick={() => { setDetailStudent(null); openPaymentModal(detailStudent) }}
                          className="text-xs text-primary hover:underline"
                        >
                          Cambiar
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Sección 2: Historial de exámenes */}
            <div>
              <h4 className="font-display font-semibold text-text-main mb-2">Historial de exámenes</h4>
              {detailSessions.length === 0 ? (
                <p className="text-sm text-text-muted py-4">Este alumno no ha presentado exámenes.</p>
              ) : (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Simulacro</th>
                        <th className="px-3 py-2 text-center font-medium">Intento</th>
                        <th className="px-3 py-2 text-center font-medium">Score</th>
                        <th className="px-3 py-2 text-center font-medium">Aciertos</th>
                        <th className="px-3 py-2 text-center font-medium">Tiempo</th>
                        <th className="px-3 py-2 text-center font-medium">Estado</th>
                        <th className="px-3 py-2 text-center font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailSessions.map((sess) => {
                        const st = sessionStatusConfig[sess.status] || sessionStatusConfig.in_progress
                        return (
                          <tr key={sess.id}>
                            <td className="px-3 py-2">
                              #{sess.exams?.exam_number} — {sess.exams?.programs?.code}
                            </td>
                            <td className="px-3 py-2 text-center">{sess.attempt_number}</td>
                            <td className={`px-3 py-2 text-center font-bold ${scoreColor(sess.score || 0)}`}>
                              {sess.score != null ? `${Number(sess.score).toFixed(0)}%` : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {sess.total_correct}/{sess.total_questions}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {formatTime(sess.time_used_seconds || 0)}
                            </td>
                            <td className={`px-3 py-2 text-center font-medium ${st.cls}`}>
                              {st.label}
                            </td>
                            <td className="px-3 py-2 text-center text-text-muted">
                              {new Date(sess.started_at).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sección 3: Pagos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-semibold text-text-main">Pagos</h4>
                <Button variant="secondary" size="sm" onClick={handleManualPayment}>
                  + Registrar pago manual
                </Button>
              </div>
              {detailPayments.length === 0 ? (
                <p className="text-sm text-text-muted py-4">No hay pagos registrados.</p>
              ) : (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Monto</th>
                        <th className="px-3 py-2 text-left font-medium">Proveedor</th>
                        <th className="px-3 py-2 text-center font-medium">Estado</th>
                        <th className="px-3 py-2 text-left font-medium">Referencia</th>
                        <th className="px-3 py-2 text-center font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailPayments.map((p) => {
                        const ps = paymentStatusConfig[p.status] || paymentStatusConfig.pending
                        return (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-medium">
                              ${Number(p.amount).toFixed(2)} {p.currency}
                            </td>
                            <td className="px-3 py-2">
                              {paymentProviderLabels[p.provider] || p.provider}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ps.cls}`}>
                                {ps.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-text-muted">{p.provider_reference || '—'}</td>
                            <td className="px-3 py-2 text-center text-text-muted">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal cambiar estado de pago */}
      <Modal
        open={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        title="Cambiar estado de pago"
        size="sm"
      >
        {paymentModal && (
          <div className="space-y-4">
            <p className="text-sm text-text-body">
              Alumno: <strong>{paymentModal.name}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Estado de pago</label>
              <select
                value={newPaymentStatus}
                onChange={(e) => setNewPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="free_trial">Free Trial</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
              </select>
              {newPaymentStatus === 'paid' && (
                <p className="text-xs text-text-muted mt-1">
                  Se creará un registro de pago manual automáticamente.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setPaymentModal(null)} disabled={paymentSaving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handlePaymentChange} loading={paymentSaving}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
