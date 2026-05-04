import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const statusConfig = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-text-body' },
  available: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  closed: { label: 'Cerrado', cls: 'bg-red-100 text-red-700' },
}
const statusCycle = { draft: 'available', available: 'closed', closed: 'draft' }

const emptyForm = {
  institution_id: '',
  program_id: '',
  exam_number: 1,
  time_minutes: 120,
  num_options: 4,
  max_attempts: 3,
  is_free: false,
  status: 'draft',
}

export default function Exams() {
  const toast = useToast()
  const navigate = useNavigate()

  // Filtros
  const [institutions, setInstitutions] = useState([])
  const [programs, setPrograms] = useState([])
  const [filterInst, setFilterInst] = useState('')
  const [filterProg, setFilterProg] = useState('')

  // Exámenes
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formPrograms, setFormPrograms] = useState([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Modal detalle de completitud
  const [detailExam, setDetailExam] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const loadExams = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('exams')
      .select(`
        *,
        programs(
          id, name, code, institution_id,
          institutions(id, name),
          program_subjects(question_count)
        ),
        questions(count)
      `)
      .order('exam_number')

    if (filterProg) {
      query = query.eq('program_id', filterProg)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Exams] load error:', error.message)
      toast('Error al cargar exámenes', 'error')
      setLoading(false)
      return
    }

    let filtered = data || []
    if (filterInst && !filterProg) {
      filtered = filtered.filter(
        (e) => e.programs?.institution_id === filterInst
      )
    }

    setExams(
      filtered.map((e) => {
        const loaded = e.questions?.[0]?.count || 0
        const required =
          e.programs?.program_subjects?.reduce(
            (s, ps) => s + (ps.question_count || 0),
            0
          ) || 0
        return { ...e, loaded, required }
      })
    )
    setLoading(false)
  }, [filterInst, filterProg, toast])

  useEffect(() => {
    loadExams()
  }, [loadExams])

  // --- Modal crear/editar ---
  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, institution_id: filterInst, program_id: filterProg })
    setFormPrograms(filterInst ? programs : [])
    setFormError(null)
    setModalOpen(true)
    if (filterInst) loadFormPrograms(filterInst)
  }

  const openEdit = (exam) => {
    const instId = exam.programs?.institution_id || ''
    setEditing(exam)
    setForm({
      institution_id: instId,
      program_id: exam.program_id,
      exam_number: exam.exam_number,
      time_minutes: exam.time_minutes,
      num_options: exam.num_options,
      max_attempts: exam.max_attempts,
      is_free: exam.is_free,
      status: exam.status,
    })
    setFormError(null)
    setModalOpen(true)
    loadFormPrograms(instId)
  }

  const loadFormPrograms = async (instId) => {
    if (!instId) {
      setFormPrograms([])
      return
    }
    const { data } = await supabase
      .from('programs')
      .select('id, name, code')
      .eq('institution_id', instId)
      .order('name')
    setFormPrograms(data || [])
  }

  const handleFormInstChange = (instId) => {
    setForm((prev) => ({ ...prev, institution_id: instId, program_id: '' }))
    loadFormPrograms(instId)
  }

  const handleFormProgChange = async (progId) => {
    setForm((prev) => ({ ...prev, program_id: progId }))
    if (!progId || editing) return
    // Sugerir siguiente exam_number
    const { data } = await supabase
      .from('exams')
      .select('exam_number')
      .eq('program_id', progId)
      .order('exam_number', { ascending: false })
      .limit(1)
    const next = (data?.[0]?.exam_number || 0) + 1
    setForm((prev) => ({ ...prev, exam_number: next, is_free: next === 1 }))
  }

  const handleSave = async () => {
    if (!form.program_id) {
      setFormError('Selecciona una carrera')
      return
    }
    setSaving(true)
    setFormError(null)

    const payload = {
      program_id: form.program_id,
      exam_number: parseInt(form.exam_number) || 1,
      time_minutes: parseInt(form.time_minutes) || 120,
      num_options: parseInt(form.num_options) || 4,
      max_attempts: parseInt(form.max_attempts) || 3,
      is_free: form.is_free,
      status: form.status,
    }

    const { error } = editing
      ? await supabase.from('exams').update(payload).eq('id', editing.id)
      : await supabase.from('exams').insert(payload)

    if (error) {
      setFormError(error.message.includes('duplicate')
        ? 'Ya existe un simulacro con ese número para esta carrera'
        : error.message)
      setSaving(false)
      return
    }

    toast(editing ? 'Simulacro actualizado' : 'Simulacro creado', 'success')
    setSaving(false)
    setModalOpen(false)
    loadExams()
  }

  // --- Cambiar estado ---
  const cycleStatus = async (exam) => {
    const next = statusCycle[exam.status]
    const { error } = await supabase
      .from('exams')
      .update({ status: next })
      .eq('id', exam.id)
    if (error) {
      toast('Error al cambiar estado', 'error')
      return
    }
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, status: next } : e))
    )
    toast(`Estado cambiado a ${statusConfig[next].label}`, 'success')
  }

  // --- Detalle de completitud ---
  const openDetail = async (exam) => {
    setDetailExam(exam)
    setDetailLoading(true)
    setDetailData(null)

    const [{ data: subjects }, { data: questions }] = await Promise.all([
      supabase
        .from('program_subjects')
        .select('name, question_count, order_index')
        .eq('program_id', exam.program_id)
        .order('order_index'),
      supabase.from('questions').select('subject').eq('exam_id', exam.id),
    ])

    const countBySubject = {}
    ;(questions || []).forEach((q) => {
      countBySubject[q.subject] = (countBySubject[q.subject] || 0) + 1
    })

    setDetailData(
      (subjects || []).map((s) => ({
        name: s.name,
        required: s.question_count,
        loaded: countBySubject[s.name] || 0,
      }))
    )
    setDetailLoading(false)
  }

  // --- Eliminar ---
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', deleteTarget.id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }
    toast('Simulacro eliminado', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadExams()
  }

  const semaphore = (loaded, required) => {
    if (required === 0) return 'bg-gray-200'
    if (loaded >= required) return 'bg-success'
    if (loaded > 0) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">
          Exámenes
        </h1>
        <Button variant="accent" onClick={openCreate}>
          + Nuevo Simulacro
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterInst}
          onChange={(e) => setFilterInst(e.target.value)}
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
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Carrera</th>
                  <th className="px-4 py-3 font-medium">Institución</th>
                  <th className="px-4 py-3 font-medium text-center">Tiempo</th>
                  <th className="px-4 py-3 font-medium text-center">Opc.</th>
                  <th className="px-4 py-3 font-medium text-center">Intentos</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium text-center">Preguntas</th>
                  <th className="px-4 py-3 font-medium text-center">Gratis</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exams.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                      No hay simulacros{filterInst || filterProg ? ' con estos filtros' : ''}.
                    </td>
                  </tr>
                ) : (
                  exams.map((exam) => {
                    const pct = exam.required > 0
                      ? Math.min(Math.round((exam.loaded / exam.required) * 100), 100)
                      : 0
                    const st = statusConfig[exam.status]
                    return (
                      <tr key={exam.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium">{exam.exam_number}</td>
                        <td className="px-4 py-3 text-text-main">
                          {exam.programs?.code} — {exam.programs?.name}
                        </td>
                        <td className="px-4 py-3 text-text-body">
                          {exam.programs?.institutions?.name}
                        </td>
                        <td className="px-4 py-3 text-center">{exam.time_minutes} min</td>
                        <td className="px-4 py-3 text-center">{exam.num_options}</td>
                        <td className="px-4 py-3 text-center">{exam.max_attempts}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDetail(exam)}
                            className="flex items-center gap-2 mx-auto hover:opacity-80"
                            title="Ver detalle por materia"
                          >
                            <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${semaphore(exam.loaded, exam.required)}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-body whitespace-nowrap">
                              {exam.loaded}/{exam.required}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {exam.is_free ? '✅' : '❌'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(exam)} className="text-text-muted hover:text-primary transition-colors" title="Editar">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            <button onClick={() => cycleStatus(exam)} className="text-text-muted hover:text-accent transition-colors" title="Cambiar estado">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                              </svg>
                            </button>
                            <button onClick={() => navigate(`/admin/questions?exam=${exam.id}`)} className="text-text-muted hover:text-info transition-colors" title="Ver preguntas">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteTarget(exam)} className="text-text-muted hover:text-danger transition-colors" title="Eliminar">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
        </Card>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Simulacro' : 'Nuevo Simulacro'}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-text-main mb-1">Institución</label>
              <select
                value={form.institution_id}
                onChange={(e) => handleFormInstChange(e.target.value)}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Seleccionar...</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-text-main mb-1">
                Carrera <span className="text-danger">*</span>
              </label>
              <select
                value={form.program_id}
                onChange={(e) => handleFormProgChange(e.target.value)}
                disabled={!form.institution_id}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {formPrograms.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1"># Simulacro</label>
              <input
                type="number" min={1}
                value={form.exam_number}
                onChange={(e) => setForm((p) => ({ ...p, exam_number: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Tiempo (min)</label>
              <input
                type="number" min={1}
                value={form.time_minutes}
                onChange={(e) => setForm((p) => ({ ...p, time_minutes: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Max intentos</label>
              <input
                type="number" min={1}
                value={form.max_attempts}
                onChange={(e) => setForm((p) => ({ ...p, max_attempts: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">Opciones por pregunta</label>
              <div className="flex gap-4">
                {[3, 4].map((n) => (
                  <label key={n} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="num_options" value={n}
                      checked={parseInt(form.num_options) === n}
                      onChange={() => setForm((p) => ({ ...p, num_options: n }))}
                      className="accent-primary"
                    />
                    <span className="text-sm">{n} opciones</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="draft">Borrador</option>
                <option value="available">Disponible</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setForm((p) => ({ ...p, is_free: !p.is_free }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_free ? 'bg-success' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_free ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-text-body">Gratis</span>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle completitud */}
      <Modal
        open={!!detailExam}
        onClose={() => setDetailExam(null)}
        title={`Completitud — Simulacro #${detailExam?.exam_number}`}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : detailData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-text-body">
                  <th className="px-3 py-2 font-medium">Materia</th>
                  <th className="px-3 py-2 font-medium text-center">Requeridas</th>
                  <th className="px-3 py-2 font-medium text-center">Cargadas</th>
                  <th className="px-3 py-2 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailData.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-2 font-medium text-text-main">{row.name}</td>
                    <td className="px-3 py-2 text-center">{row.required}</td>
                    <td className="px-3 py-2 text-center">{row.loaded}</td>
                    <td className="px-3 py-2 text-center text-lg">
                      {row.loaded >= row.required && row.required > 0
                        ? '✅'
                        : row.loaded > 0
                          ? '⚠️'
                          : '❌'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-center">
                    {detailData.reduce((s, r) => s + r.required, 0)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {detailData.reduce((s, r) => s + r.loaded, 0)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar simulacro"
        message={`Se eliminará el simulacro #${deleteTarget?.exam_number} y todas sus preguntas. Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </div>
  )
}
