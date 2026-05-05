import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { renderLatex, stripLatex } from '../../lib/renderLatex'
import { parseTextToQuestions, validateParsedQuestions } from '../../lib/questionParser'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const PAGE_SIZE = 20

const subjectColors = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-yellow-100 text-yellow-700',
  'bg-red-100 text-red-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
]

function subjectColor(name, allSubjects) {
  const idx = allSubjects.indexOf(name)
  return subjectColors[idx >= 0 ? idx % subjectColors.length : 0]
}

const emptyForm = {
  subject: '',
  question_text: '',
  image_url: '',
  reading_id: '',
  audio_id: '',
  options: [
    { key: 'A', text: '', image_url: '' },
    { key: 'B', text: '', image_url: '' },
    { key: 'C', text: '', image_url: '' },
    { key: 'D', text: '', image_url: '' },
  ],
  correct_answer: '',
  justification: '',
}

const tabLabels = ['Contenido', 'Opciones', 'Justificación']
const bulkTabLabels = ['Carga por JSON', 'Carga por Texto']

export default function Questions() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // --- Filtros ---
  const [institutions, setInstitutions] = useState([])
  const [programs, setPrograms] = useState([])
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [filterInst, setFilterInst] = useState('')
  const [filterProg, setFilterProg] = useState('')
  const [filterExam, setFilterExam] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [search, setSearch] = useState('')

  // --- Tabla ---
  const [questions, setQuestions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  // --- Modal crear/editar ---
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [formSubjects, setFormSubjects] = useState([])
  const [formReadings, setFormReadings] = useState([])
  const [formAudios, setFormAudios] = useState([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [selectedExamData, setSelectedExamData] = useState(null)

  // --- Modal carga masiva ---
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkTab, setBulkTab] = useState(0)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkSubject, setBulkSubject] = useState('')
  const [bulkParsed, setBulkParsed] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  // --- Eliminar ---
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const subjectNames = useMemo(() => subjects.map((s) => s.name), [subjects])
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // --- Cargar instituciones ---
  useEffect(() => {
    supabase
      .from('institutions')
      .select('id, name')
      .order('name')
      .then(({ data }) => setInstitutions(data || []))
  }, [])

  // --- Filtro cascada: institución → programas ---
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
        if (!searchParams.get('exam')) setFilterProg('')
      })
  }, [filterInst])

  // --- Filtro cascada: programa → exámenes ---
  useEffect(() => {
    if (!filterProg) {
      setExams([])
      setFilterExam('')
      return
    }
    supabase
      .from('exams')
      .select('id, exam_number, num_options, program_id')
      .eq('program_id', filterProg)
      .order('exam_number')
      .then(({ data }) => {
        setExams(data || [])
        if (!searchParams.get('exam')) setFilterExam('')
      })
  }, [filterProg])

  // --- Filtro cascada: examen → materias ---
  useEffect(() => {
    if (!filterExam) {
      setSubjects([])
      setFilterSubject('')
      setSelectedExamData(null)
      return
    }
    const exam = exams.find((e) => e.id === filterExam)
    setSelectedExamData(exam || null)
    if (!exam) return

    supabase
      .from('program_subjects')
      .select('id, name, question_count, order_index')
      .eq('program_id', exam.program_id)
      .order('order_index')
      .then(({ data }) => {
        setSubjects(data || [])
        setFilterSubject('')
      })
  }, [filterExam, exams])

  // --- Inicialización desde URL params (viene de Exams → "Ver preguntas") ---
  useEffect(() => {
    const examParam = searchParams.get('exam')
    if (!examParam) return

    const loadExamContext = async () => {
      const { data: exam } = await supabase
        .from('exams')
        .select('id, exam_number, num_options, program_id, programs(id, name, code, institution_id)')
        .eq('id', examParam)
        .single()

      if (!exam) return

      setFilterInst(exam.programs.institution_id)

      // Esperar a que las cascadas se carguen
      const { data: progs } = await supabase
        .from('programs')
        .select('id, name, code')
        .eq('institution_id', exam.programs.institution_id)
        .order('name')
      setPrograms(progs || [])
      setFilterProg(exam.program_id)

      const { data: exs } = await supabase
        .from('exams')
        .select('id, exam_number, num_options, program_id')
        .eq('program_id', exam.program_id)
        .order('exam_number')
      setExams(exs || [])
      setFilterExam(exam.id)

      setSearchParams({}, { replace: true })
    }

    loadExamContext()
  }, [])

  // --- Cargar preguntas ---
  const loadQuestions = useCallback(async () => {
    if (!filterExam) {
      setQuestions([])
      setTotalCount(0)
      return
    }
    setLoading(true)

    let query = supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .eq('exam_id', filterExam)
      .order('order_index')

    if (filterSubject) {
      query = query.eq('subject', filterSubject)
    }
    if (search.trim()) {
      query = query.ilike('question_text', `%${search.trim()}%`)
    }

    const from = page * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (error) {
      toast('Error al cargar preguntas', 'error')
      setLoading(false)
      return
    }

    setQuestions(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }, [filterExam, filterSubject, search, page, toast])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  useEffect(() => {
    setPage(0)
  }, [filterExam, filterSubject, search])

  // --- Modal crear/editar ---
  const loadFormMetadata = async (examId) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam) return

    const [{ data: subs }, { data: reads }, { data: auds }] = await Promise.all([
      supabase
        .from('program_subjects')
        .select('id, name')
        .eq('program_id', exam.program_id)
        .order('order_index'),
      supabase
        .from('readings')
        .select('id, title')
        .eq('institution_id', filterInst)
        .order('title'),
      supabase
        .from('audios')
        .select('id, title')
        .eq('institution_id', filterInst)
        .order('title'),
    ])

    setFormSubjects(subs || [])
    setFormReadings(reads || [])
    setFormAudios(auds || [])
  }

  const openCreate = () => {
    if (!filterExam) {
      toast('Selecciona un examen primero', 'warning')
      return
    }
    setEditing(null)
    setForm({ ...emptyForm, options: emptyForm.options.map((o) => ({ ...o })) })
    setActiveTab(0)
    setFormError(null)
    setModalOpen(true)
    loadFormMetadata(filterExam)
  }

  const openEdit = (question) => {
    setEditing(question)
    const opts = (question.options || []).map((o) => ({
      key: o.key,
      text: o.text || '',
      image_url: o.image_url || '',
    }))
    while (opts.length < 4) {
      opts.push({ key: ['A', 'B', 'C', 'D'][opts.length], text: '', image_url: '' })
    }
    setForm({
      subject: question.subject || '',
      question_text: question.question_text || '',
      image_url: question.image_url || '',
      reading_id: question.reading_id || '',
      audio_id: question.audio_id || '',
      options: opts,
      correct_answer: question.correct_answer || '',
      justification: question.justification || '',
    })
    setActiveTab(0)
    setFormError(null)
    setModalOpen(true)
    loadFormMetadata(filterExam)
  }

  const handleDuplicate = (question) => {
    setEditing(null)
    const opts = (question.options || []).map((o) => ({
      key: o.key,
      text: o.text || '',
      image_url: o.image_url || '',
    }))
    while (opts.length < 4) {
      opts.push({ key: ['A', 'B', 'C', 'D'][opts.length], text: '', image_url: '' })
    }
    setForm({
      subject: question.subject || '',
      question_text: question.question_text || '',
      image_url: question.image_url || '',
      reading_id: question.reading_id || '',
      audio_id: question.audio_id || '',
      options: opts,
      correct_answer: question.correct_answer || '',
      justification: question.justification || '',
    })
    setActiveTab(0)
    setFormError(null)
    setModalOpen(true)
    loadFormMetadata(filterExam)
    toast('Pregunta duplicada — edita y guarda', 'info')
  }

  const updateOption = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === index ? { ...o, [field]: value } : o
      ),
    }))
  }

  const handleSave = async () => {
    if (!form.subject) {
      setFormError('Selecciona una materia')
      return
    }
    if (!form.question_text.trim()) {
      setFormError('El texto de la pregunta es requerido')
      return
    }
    if (!form.correct_answer) {
      setFormError('Selecciona la respuesta correcta')
      return
    }

    const numOpts = selectedExamData?.num_options || 4
    const filledOpts = form.options.slice(0, numOpts)
    const emptyOpts = filledOpts.filter((o) => !o.text.trim())
    if (emptyOpts.length > 0) {
      setFormError(`Completa el texto de todas las opciones (${numOpts} requeridas)`)
      return
    }

    setSaving(true)
    setFormError(null)

    let orderIndex = 0
    if (!editing) {
      const { data: maxRow } = await supabase
        .from('questions')
        .select('order_index')
        .eq('exam_id', filterExam)
        .order('order_index', { ascending: false })
        .limit(1)
      orderIndex = (maxRow?.[0]?.order_index || 0) + 1
    }

    const options = filledOpts.map((o) => ({
      key: o.key,
      text: o.text.trim(),
      image_url: o.image_url || null,
    }))

    const payload = {
      exam_id: filterExam,
      subject: form.subject,
      question_text: form.question_text.trim(),
      image_url: form.image_url || null,
      reading_id: form.reading_id || null,
      audio_id: form.audio_id || null,
      options,
      correct_answer: form.correct_answer,
      justification: form.justification.trim() || null,
      ...(editing ? {} : { order_index: orderIndex }),
    }

    const { error } = editing
      ? await supabase.from('questions').update(payload).eq('id', editing.id)
      : await supabase.from('questions').insert(payload)

    if (error) {
      setFormError(error.message)
      setSaving(false)
      return
    }

    toast(editing ? 'Pregunta actualizada' : 'Pregunta creada', 'success')
    setSaving(false)
    setModalOpen(false)
    loadQuestions()
  }

  // --- Eliminar ---
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('questions').delete().eq('id', deleteTarget.id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }
    toast('Pregunta eliminada', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadQuestions()
  }

  // --- Carga masiva ---
  const openBulk = () => {
    if (!filterExam) {
      toast('Selecciona un examen primero', 'warning')
      return
    }
    setBulkTab(0)
    setBulkJson('')
    setBulkText('')
    setBulkSubject('')
    setBulkParsed(null)
    setBulkError(null)
    setBulkOpen(true)
    loadFormMetadata(filterExam)
  }

  const handleBulkParseJson = () => {
    setBulkError(null)
    try {
      const parsed = JSON.parse(bulkJson)
      if (!Array.isArray(parsed)) {
        setBulkError('Debe ser un array JSON')
        return
      }
      const validated = validateParsedQuestions(
        parsed.map((q) => ({
          subject: q.subject || '',
          question_text: q.question_text || '',
          options: (q.options || []).map((o) => ({ key: o.key, text: o.text })),
          correct_answer: q.correct_answer || '',
          justification: q.justification || '',
        }))
      )
      setBulkParsed(validated)
    } catch {
      setBulkError('JSON inválido: verifica la sintaxis')
    }
  }

  const handleBulkParseText = () => {
    setBulkError(null)
    const parsed = parseTextToQuestions(bulkText, bulkSubject)
    if (parsed.length === 0) {
      setBulkError('No se detectaron preguntas. Verifica el formato.')
      return
    }
    setBulkParsed(validateParsedQuestions(parsed))
  }

  const bulkSummary = useMemo(() => {
    if (!bulkParsed) return null
    const bySubject = {}
    let valid = 0
    let invalid = 0
    for (const q of bulkParsed) {
      const s = q.subject || '(Sin materia)'
      bySubject[s] = (bySubject[s] || 0) + 1
      if (q._valid) valid++
      else invalid++
    }
    return { bySubject, valid, invalid, total: bulkParsed.length }
  }, [bulkParsed])

  const handleBulkLoad = async () => {
    if (!bulkParsed || !filterExam) return

    const validQuestions = bulkParsed.filter((q) => q._valid)
    if (validQuestions.length === 0) {
      setBulkError('No hay preguntas válidas para cargar')
      return
    }

    setBulkLoading(true)
    setBulkError(null)

    const { data: maxRow } = await supabase
      .from('questions')
      .select('order_index')
      .eq('exam_id', filterExam)
      .order('order_index', { ascending: false })
      .limit(1)

    let nextIndex = (maxRow?.[0]?.order_index || 0) + 1

    const rows = validQuestions.map((q) => ({
      exam_id: filterExam,
      subject: q.subject,
      question_text: q.question_text,
      options: q.options.map((o) => ({ key: o.key, text: o.text, image_url: null })),
      correct_answer: q.correct_answer,
      justification: q.justification || null,
      order_index: nextIndex++,
    }))

    const { error } = await supabase.from('questions').insert(rows)

    if (error) {
      setBulkError('Error al insertar: ' + error.message)
      setBulkLoading(false)
      return
    }

    toast(`${rows.length} preguntas cargadas`, 'success')
    setBulkLoading(false)
    setBulkOpen(false)
    loadQuestions()
  }

  // --- Render helpers ---
  const numOpts = selectedExamData?.num_options || 4

  const LatexPreview = ({ text, className = '' }) => (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderLatex(text || '') }}
    />
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">Preguntas</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openBulk}>
            Carga Masiva
          </Button>
          <Button variant="accent" onClick={openCreate}>
            + Nueva Pregunta
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterInst}
          onChange={(e) => { setFilterInst(e.target.value); setFilterProg(''); setFilterExam(''); setFilterSubject('') }}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Institución...</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        <select
          value={filterProg}
          onChange={(e) => { setFilterProg(e.target.value); setFilterExam(''); setFilterSubject('') }}
          disabled={!filterInst}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        >
          <option value="">Carrera...</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>

        <select
          value={filterExam}
          onChange={(e) => { setFilterExam(e.target.value); setFilterSubject('') }}
          disabled={!filterProg}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        >
          <option value="">Simulacro...</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>#{e.exam_number}</option>
          ))}
        </select>

        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          disabled={!filterExam}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        >
          <option value="">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar en texto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={!filterExam}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 min-w-[200px]"
        />
      </div>

      {/* Info: seleccionar examen */}
      {!filterExam && (
        <Card className="text-center py-12">
          <p className="text-text-muted">Selecciona una institución, carrera y simulacro para ver las preguntas.</p>
        </Card>
      )}

      {/* Tabla */}
      {filterExam && (
        <>
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
                      <th className="px-4 py-3 font-medium w-12">#</th>
                      <th className="px-4 py-3 font-medium">Materia</th>
                      <th className="px-4 py-3 font-medium">Texto</th>
                      <th className="px-4 py-3 font-medium text-center w-16">Resp.</th>
                      <th className="px-4 py-3 font-medium text-center w-12" title="Imagen">Img</th>
                      <th className="px-4 py-3 font-medium text-center w-12" title="Lectura">Lec</th>
                      <th className="px-4 py-3 font-medium text-center w-12" title="Audio">Aud</th>
                      <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {questions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                          No hay preguntas{filterSubject || search ? ' con estos filtros' : ' en este simulacro'}.
                        </td>
                      </tr>
                    ) : (
                      questions.map((q) => (
                        <tr key={q.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-text-body">{q.order_index}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${subjectColor(q.subject, subjectNames)}`}>
                              {q.subject}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-main max-w-xs truncate">
                            {stripLatex(q.question_text).slice(0, 80)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">
                              {q.correct_answer}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q.image_url ? (
                              <svg className="h-4 w-4 mx-auto text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                              </svg>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q.reading_id ? (
                              <svg className="h-4 w-4 mx-auto text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                              </svg>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q.audio_id ? (
                              <svg className="h-4 w-4 mx-auto text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                              </svg>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(q)} className="text-text-muted hover:text-primary transition-colors" title="Editar">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                              </button>
                              <button onClick={() => handleDuplicate(q)} className="text-text-muted hover:text-accent transition-colors" title="Duplicar">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteTarget(q)} className="text-text-muted hover:text-danger transition-colors" title="Eliminar">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <span className="text-xs text-text-muted">
                    {totalCount} pregunta{totalCount !== 1 ? 's' : ''} — Página {page + 1} de {totalPages}
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
        </>
      )}

      {/* ======== Modal crear/editar pregunta ======== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Pregunta' : 'Nueva Pregunta'}
        size="3xl"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
              {formError}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {tabLabels.map((label, i) => (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-body'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 0: Contenido */}
          {activeTab === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">
                  Materia <span className="text-danger">*</span>
                </label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Seleccionar...</option>
                  {formSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-main mb-1">
                  Texto de la pregunta <span className="text-danger">*</span>
                </label>
                <textarea
                  value={form.question_text}
                  onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
                  rows={4}
                  placeholder="Escribe la pregunta. Usa $formula$ para LaTeX inline o $$formula$$ para display."
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
                {form.question_text && (
                  <div className="mt-2 p-3 rounded bg-gray-50 border border-gray-200">
                    <span className="text-xs text-text-muted block mb-1">Vista previa:</span>
                    <LatexPreview text={form.question_text} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-main mb-1">URL de imagen</label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-text-main">Lectura asociada</label>
                    <Link to="/admin/readings" className="text-xs text-primary hover:underline">Gestionar lecturas</Link>
                  </div>
                  <select
                    value={form.reading_id}
                    onChange={(e) => setForm((p) => ({ ...p, reading_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Ninguna</option>
                    {formReadings.map((r) => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-text-main">Audio asociado</label>
                    <Link to="/admin/audios" className="text-xs text-primary hover:underline">Gestionar audios</Link>
                  </div>
                  <select
                    value={form.audio_id}
                    onChange={(e) => setForm((p) => ({ ...p, audio_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Ninguno</option>
                    {formAudios.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Opciones */}
          {activeTab === 1 && (
            <div className="space-y-4">
              {['A', 'B', 'C', 'D'].slice(0, numOpts).map((key, idx) => (
                <div key={key} className="p-3 rounded border border-gray-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="correct_answer"
                        checked={form.correct_answer === key}
                        onChange={() => setForm((p) => ({ ...p, correct_answer: key }))}
                        className="accent-primary"
                      />
                      <span className="text-sm font-bold text-text-main">Opción {key}</span>
                    </label>
                    {form.correct_answer === key && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">Correcta</span>
                    )}
                  </div>
                  <textarea
                    value={form.options[idx]?.text || ''}
                    onChange={(e) => updateOption(idx, 'text', e.target.value)}
                    rows={2}
                    placeholder={`Texto de la opción ${key}`}
                    className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <input
                    type="text"
                    value={form.options[idx]?.image_url || ''}
                    onChange={(e) => updateOption(idx, 'image_url', e.target.value)}
                    placeholder="URL de imagen (opcional)"
                    className="w-full px-3 py-1.5 rounded border border-gray-200 bg-white text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              ))}

              <div className="p-3 rounded bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  Selecciona el radio button de la opción correcta. Este examen tiene {numOpts} opciones por pregunta.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Justificación */}
          {activeTab === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Justificación</label>
                <textarea
                  value={form.justification}
                  onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))}
                  rows={5}
                  placeholder="Explicación de la respuesta correcta. Soporta LaTeX con $formula$."
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
                {form.justification && (
                  <div className="mt-2 p-3 rounded bg-gray-50 border border-gray-200">
                    <span className="text-xs text-text-muted block mb-1">Vista previa:</span>
                    <LatexPreview text={form.justification} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vista previa general */}
          {form.question_text && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">Vista previa del alumno</h4>
              <div className="p-4 rounded border border-gray-200 bg-gray-50 space-y-3">
                <LatexPreview text={form.question_text} className="text-text-main" />
                {form.image_url && (
                  <img src={form.image_url} alt="" className="max-h-40 rounded border" />
                )}
                <div className="space-y-2">
                  {form.options.slice(0, numOpts).map((opt) => (
                    opt.text && (
                      <label key={opt.key} className={`flex items-start gap-2 p-2 rounded border ${form.correct_answer === opt.key ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                        <input type="radio" disabled checked={form.correct_answer === opt.key} className="mt-0.5 accent-primary" />
                        <span className="text-sm">
                          <strong>{opt.key})</strong>{' '}
                          <span dangerouslySetInnerHTML={{ __html: renderLatex(opt.text) }} />
                        </span>
                      </label>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======== Modal carga masiva ======== */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Carga Masiva de Preguntas"
        size="3xl"
      >
        <div className="space-y-4">
          {bulkError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
              {bulkError}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {bulkTabLabels.map((label, i) => (
              <button
                key={label}
                onClick={() => { setBulkTab(i); setBulkParsed(null); setBulkError(null) }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  bulkTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-body'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 0: JSON */}
          {bulkTab === 0 && (
            <div className="space-y-3">
              <textarea
                value={bulkJson}
                onChange={(e) => { setBulkJson(e.target.value); setBulkParsed(null) }}
                rows={10}
                placeholder={'[\n  {\n    "subject": "Álgebra",\n    "question_text": "¿Cuánto es $2x + 3 = 7$?",\n    "options": [\n      {"key": "A", "text": "x = 1"},\n      {"key": "B", "text": "x = 2"}\n    ],\n    "correct_answer": "B",\n    "justification": "2x = 4, x = 2"\n  }\n]'}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
              <Button variant="secondary" onClick={handleBulkParseJson} disabled={!bulkJson.trim()}>
                Validar JSON
              </Button>
            </div>
          )}

          {/* Tab 1: Texto */}
          {bulkTab === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">
                  Materia por defecto (si no hay secciones en el texto)
                </label>
                <select
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Seleccionar...</option>
                  {formSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); setBulkParsed(null) }}
                rows={10}
                placeholder={"SECCIÓN: Álgebra\n\n1. ¿Cuál es el resultado de $3x + 5 = 20$?\nA) x = 3\nB) x = 5 *\nC) x = 7\nD) x = 10\nJustificación: 3x = 15, x = 5"}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
              <Button variant="secondary" onClick={handleBulkParseText} disabled={!bulkText.trim()}>
                Parsear Texto
              </Button>
            </div>
          )}

          {/* Resultados del parseo */}
          {bulkParsed && bulkSummary && (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              {/* Resumen */}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="font-medium text-text-main">{bulkSummary.total} preguntas detectadas</span>
                <span className="text-success">{bulkSummary.valid} válidas</span>
                {bulkSummary.invalid > 0 && (
                  <span className="text-danger">{bulkSummary.invalid} con errores</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(bulkSummary.bySubject).map(([subj, count]) => (
                  <span key={subj} className="inline-block px-2 py-0.5 rounded bg-gray-100 text-xs text-text-body">
                    {subj}: {count}
                  </span>
                ))}
              </div>

              {/* Preview tabla */}
              <div className="max-h-64 overflow-y-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Materia</th>
                      <th className="px-2 py-1.5 text-left font-medium">Texto</th>
                      <th className="px-2 py-1.5 text-center font-medium">Resp.</th>
                      <th className="px-2 py-1.5 text-center font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkParsed.map((q) => (
                      <tr key={q._index} className={q._valid ? '' : 'bg-red-50'}>
                        <td className="px-2 py-1.5">{q._index}</td>
                        <td className="px-2 py-1.5">{q.subject || '—'}</td>
                        <td className="px-2 py-1.5 max-w-xs truncate">
                          {stripLatex(q.question_text).slice(0, 60)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold">{q.correct_answer || '—'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {q._valid ? (
                            <span className="text-success">✓</span>
                          ) : (
                            <span className="text-danger" title={q._errors.join(', ')}>✗ {q._errors[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="primary"
                  onClick={handleBulkLoad}
                  loading={bulkLoading}
                  disabled={bulkSummary.valid === 0}
                >
                  Cargar {bulkSummary.valid} preguntas a BD
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar pregunta"
        message={`Se eliminará la pregunta #${deleteTarget?.order_index}. Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </div>
  )
}
