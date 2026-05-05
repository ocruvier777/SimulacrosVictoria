import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const langConfig = {
  es: { label: 'Español', flag: '🇲🇽', cls: 'bg-green-100 text-green-700' },
  en: { label: 'Inglés', flag: '🇺🇸', cls: 'bg-blue-100 text-blue-700' },
}

function textLength(content) {
  const len = (content || '').length
  if (len < 500) return { label: 'Corta', cls: 'text-text-muted' }
  if (len < 1500) return { label: 'Media', cls: 'text-warning' }
  return { label: 'Larga', cls: 'text-success' }
}

const emptyForm = {
  institution_id: '',
  title: '',
  language: 'es',
  content: '',
}

export default function Readings() {
  const toast = useToast()

  const [institutions, setInstitutions] = useState([])
  const [filterInst, setFilterInst] = useState('')
  const [filterLang, setFilterLang] = useState('')
  const [search, setSearch] = useState('')

  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const [previewReading, setPreviewReading] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase
      .from('institutions')
      .select('id, name')
      .order('name')
      .then(({ data }) => setInstitutions(data || []))
  }, [])

  const loadReadings = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('readings')
      .select(`
        *,
        institutions(id, name),
        questions(count)
      `)
      .order('created_at', { ascending: false })

    if (filterInst) query = query.eq('institution_id', filterInst)
    if (filterLang) query = query.eq('language', filterLang)
    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)

    const { data, error } = await query

    if (error) {
      toast('Error al cargar lecturas', 'error')
      setLoading(false)
      return
    }

    setReadings(
      (data || []).map((r) => ({
        ...r,
        questionCount: r.questions?.[0]?.count || 0,
      }))
    )
    setLoading(false)
  }, [filterInst, filterLang, search, toast])

  useEffect(() => {
    loadReadings()
  }, [loadReadings])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, institution_id: filterInst })
    setFormError(null)
    setShowPreview(false)
    setModalOpen(true)
  }

  const openEdit = (reading) => {
    setEditing(reading)
    setForm({
      institution_id: reading.institution_id,
      title: reading.title,
      language: reading.language,
      content: reading.content,
    })
    setFormError(null)
    setShowPreview(false)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.institution_id) { setFormError('Selecciona una institución'); return }
    if (!form.title.trim()) { setFormError('El título es requerido'); return }
    if (!form.content.trim()) { setFormError('El contenido es requerido'); return }

    setSaving(true)
    setFormError(null)

    const payload = {
      institution_id: form.institution_id,
      title: form.title.trim(),
      language: form.language,
      content: form.content.trim(),
    }

    const { error } = editing
      ? await supabase.from('readings').update(payload).eq('id', editing.id)
      : await supabase.from('readings').insert(payload)

    if (error) {
      setFormError(error.message)
      setSaving(false)
      return
    }

    toast(editing ? 'Lectura actualizada' : 'Lectura creada', 'success')
    setSaving(false)
    setModalOpen(false)
    loadReadings()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('readings').delete().eq('id', deleteTarget.id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }
    toast('Lectura eliminada', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadReadings()
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">Lecturas</h1>
        <Button variant="accent" onClick={openCreate}>+ Nueva Lectura</Button>
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
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Todos los idiomas</option>
          <option value="es">{langConfig.es.flag} Español</option>
          <option value="en">{langConfig.en.flag} Inglés</option>
        </select>
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-[200px]"
        />
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
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Institución</th>
                  <th className="px-4 py-3 font-medium text-center">Idioma</th>
                  <th className="px-4 py-3 font-medium text-center">Extensión</th>
                  <th className="px-4 py-3 font-medium text-center">Preguntas</th>
                  <th className="px-4 py-3 font-medium text-center">Fecha</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      No hay lecturas{filterInst || filterLang || search ? ' con estos filtros' : ''}.
                    </td>
                  </tr>
                ) : (
                  readings.map((r) => {
                    const lang = langConfig[r.language] || langConfig.es
                    const ext = textLength(r.content)
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-text-main">{r.title}</td>
                        <td className="px-4 py-3 text-text-body">{r.institutions?.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${lang.cls}`}>
                            {lang.flag} {lang.label}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-medium ${ext.cls}`}>
                          {ext.label}
                        </td>
                        <td className="px-4 py-3 text-center">{r.questionCount}</td>
                        <td className="px-4 py-3 text-center text-text-muted text-xs">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(r)} className="text-text-muted hover:text-primary transition-colors" title="Editar">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            <button onClick={() => setPreviewReading(r)} className="text-text-muted hover:text-info transition-colors" title="Ver preview">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteTarget(r)} className="text-text-muted hover:text-danger transition-colors" title="Eliminar">
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
        title={editing ? 'Editar Lectura' : 'Nueva Lectura'}
        size="2xl"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Institución <span className="text-danger">*</span>
              </label>
              <select
                value={form.institution_id}
                onChange={(e) => setForm((p) => ({ ...p, institution_id: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Seleccionar...</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Idioma</label>
              <select
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="es">{langConfig.es.flag} Español</option>
                <option value="en">{langConfig.en.flag} Inglés</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Título <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Título de la lectura"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-text-main">
                Contenido <span className="text-danger">*</span>
              </label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-primary hover:underline"
              >
                {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </button>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              rows={10}
              placeholder="Escribe o pega el texto de la lectura aquí. Cada párrafo será separado por una línea en blanco."
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-text-muted mt-1">{form.content.length} caracteres</p>
          </div>

          {showPreview && form.content && (
            <div className="p-4 rounded bg-gray-50 border border-gray-200 max-h-64 overflow-y-auto">
              <h4 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Vista previa</h4>
              <div className="prose prose-sm max-w-none text-text-main">
                {form.content.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
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

      {/* Modal preview */}
      <Modal
        open={!!previewReading}
        onClose={() => setPreviewReading(null)}
        title={previewReading?.title || 'Lectura'}
        size="2xl"
      >
        {previewReading && (
          <div className="prose prose-sm max-w-none text-text-main max-h-96 overflow-y-auto">
            {previewReading.content.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar lectura"
        message={`Se eliminará "${deleteTarget?.title}". Las preguntas que la referencien perderán la asociación.`}
        loading={deleting}
      />
    </div>
  )
}
