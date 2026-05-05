import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const emptyForm = {
  institution_id: '',
  title: '',
  audio_url: '',
  max_plays: 2,
}

export default function Audios() {
  const toast = useToast()

  const [institutions, setInstitutions] = useState([])
  const [filterInst, setFilterInst] = useState('')
  const [search, setSearch] = useState('')

  const [audios, setAudios] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Reproductor inline
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    supabase
      .from('institutions')
      .select('id, name')
      .order('name')
      .then(({ data }) => setInstitutions(data || []))
  }, [])

  const loadAudios = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('audios')
      .select(`
        *,
        institutions(id, name),
        questions(count)
      `)
      .order('created_at', { ascending: false })

    if (filterInst) query = query.eq('institution_id', filterInst)
    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)

    const { data, error } = await query

    if (error) {
      toast('Error al cargar audios', 'error')
      setLoading(false)
      return
    }

    setAudios(
      (data || []).map((a) => ({
        ...a,
        questionCount: a.questions?.[0]?.count || 0,
      }))
    )
    setLoading(false)
  }, [filterInst, search, toast])

  useEffect(() => {
    loadAudios()
  }, [loadAudios])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, institution_id: filterInst })
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (audio) => {
    setEditing(audio)
    setForm({
      institution_id: audio.institution_id,
      title: audio.title,
      audio_url: audio.audio_url,
      max_plays: audio.max_plays,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.institution_id) { setFormError('Selecciona una institución'); return }
    if (!form.title.trim()) { setFormError('El título es requerido'); return }
    if (!form.audio_url.trim()) { setFormError('La URL del audio es requerida'); return }

    setSaving(true)
    setFormError(null)

    const payload = {
      institution_id: form.institution_id,
      title: form.title.trim(),
      audio_url: form.audio_url.trim(),
      max_plays: parseInt(form.max_plays) || 2,
    }

    const { error } = editing
      ? await supabase.from('audios').update(payload).eq('id', editing.id)
      : await supabase.from('audios').insert(payload)

    if (error) {
      setFormError(error.message)
      setSaving(false)
      return
    }

    toast(editing ? 'Audio actualizado' : 'Audio creado', 'success')
    setSaving(false)
    setModalOpen(false)
    loadAudios()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('audios').delete().eq('id', deleteTarget.id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }
    toast('Audio eliminado', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadAudios()
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">Audios</h1>
        <Button variant="accent" onClick={openCreate}>+ Nuevo Audio</Button>
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
                  <th className="px-4 py-3 font-medium text-center">Max reprod.</th>
                  <th className="px-4 py-3 font-medium text-center">Preguntas</th>
                  <th className="px-4 py-3 font-medium text-center">Fecha</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      No hay audios{filterInst || search ? ' con estos filtros' : ''}.
                    </td>
                  </tr>
                ) : (
                  audios.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-text-main">{a.title}</td>
                      <td className="px-4 py-3 text-text-body">{a.institutions?.name}</td>
                      <td className="px-4 py-3 text-center">{a.max_plays}</td>
                      <td className="px-4 py-3 text-center">{a.questionCount}</td>
                      <td className="px-4 py-3 text-center text-text-muted text-xs">
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(a)} className="text-text-muted hover:text-primary transition-colors" title="Editar">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setPlayingId(playingId === a.id ? null : a.id)}
                            className="text-text-muted hover:text-info transition-colors"
                            title="Reproducir"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              {playingId === a.id ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                              )}
                            </svg>
                          </button>
                          <button onClick={() => setDeleteTarget(a)} className="text-text-muted hover:text-danger transition-colors" title="Eliminar">
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

          {/* Reproductor inline */}
          {playingId && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <audio
                key={playingId}
                controls
                autoPlay
                className="w-full h-8"
                src={audios.find((a) => a.id === playingId)?.audio_url}
                onEnded={() => setPlayingId(null)}
              />
            </div>
          )}
        </Card>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Audio' : 'Nuevo Audio'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">{formError}</div>
          )}

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
            <label className="block text-sm font-medium text-text-main mb-1">
              Título <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Título del audio"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              URL del audio <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.audio_url}
              onChange={(e) => setForm((p) => ({ ...p, audio_url: e.target.value }))}
              placeholder="https://example.com/audio.mp3"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Max reproducciones
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={form.max_plays}
              onChange={(e) => setForm((p) => ({ ...p, max_plays: e.target.value }))}
              className="w-24 px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {form.audio_url && (
            <div className="p-3 rounded bg-gray-50 border border-gray-200">
              <p className="text-xs text-text-muted mb-2">Preview del audio:</p>
              <audio controls className="w-full h-8" src={form.audio_url} />
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar audio"
        message={`Se eliminará "${deleteTarget?.title}". Las preguntas que lo referencien perderán la asociación.`}
        loading={deleting}
      />
    </div>
  )
}
