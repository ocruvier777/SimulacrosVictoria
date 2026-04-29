import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const emptyForm = {
  name: '',
  slug: '',
  logo_url: '',
  config_json: '{}',
  is_active: true,
}

export default function Institutions() {
  const toast = useToast()
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal de crear/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Confirm dialog
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadInstitutions()
  }, [])

  const loadInstitutions = async () => {
    const { data, error } = await supabase
      .from('institutions')
      .select(`
        *,
        programs(
          id,
          exams(
            questions(count)
          )
        )
      `)
      .order('name')

    if (error) {
      toast('Error al cargar instituciones', 'error')
      setLoading(false)
      return
    }

    setInstitutions(
      (data || []).map((inst) => {
        const programCount = inst.programs?.length || 0
        const questionCount = (inst.programs || []).reduce(
          (sum, p) =>
            sum +
            (p.exams || []).reduce(
              (eSum, e) => eSum + (e.questions?.[0]?.count || 0),
              0
            ),
          0
        )
        return { ...inst, programCount, questionCount }
      })
    )
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setSlugManual(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (inst) => {
    setEditing(inst)
    setForm({
      name: inst.name,
      slug: inst.slug,
      logo_url: inst.logo_url || '',
      config_json: inst.config_json ? JSON.stringify(inst.config_json, null, 2) : '{}',
      is_active: inst.is_active,
    })
    setSlugManual(true)
    setFormError(null)
    setModalOpen(true)
  }

  const handleNameChange = (value) => {
    if (slugManual) {
      setForm((prev) => ({ ...prev, name: value }))
    } else {
      setForm((prev) => ({ ...prev, name: value, slug: generateSlug(value) }))
    }
  }

  const handleSlugChange = (value) => {
    setSlugManual(true)
    setForm((prev) => ({
      ...prev,
      slug: value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (!form.slug.trim()) {
      setFormError('El slug es obligatorio')
      return
    }

    let configJson = {}
    try {
      configJson = JSON.parse(form.config_json)
    } catch {
      setFormError('El JSON de configuración no es válido')
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      logo_url: form.logo_url.trim() || null,
      config_json: configJson,
      is_active: form.is_active,
    }

    if (editing) {
      const { error } = await supabase
        .from('institutions')
        .update(payload)
        .eq('id', editing.id)

      if (error) {
        setFormError(
          error.message.includes('duplicate')
            ? 'Ya existe una institución con ese slug'
            : error.message
        )
        setSaving(false)
        return
      }
      toast('Institución actualizada', 'success')
    } else {
      const { error } = await supabase.from('institutions').insert(payload)

      if (error) {
        setFormError(
          error.message.includes('duplicate')
            ? 'Ya existe una institución con ese slug'
            : error.message
        )
        setSaving(false)
        return
      }
      toast('Institución creada', 'success')
    }

    setSaving(false)
    setModalOpen(false)
    loadInstitutions()
  }

  const handleToggleActive = async (inst) => {
    const { error } = await supabase
      .from('institutions')
      .update({ is_active: !inst.is_active })
      .eq('id', inst.id)

    if (error) {
      toast('Error al actualizar estado', 'error')
      return
    }

    setInstitutions((prev) =>
      prev.map((i) =>
        i.id === inst.id ? { ...i, is_active: !i.is_active } : i
      )
    )
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    const { error } = await supabase
      .from('institutions')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }

    toast('Institución eliminada', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadInstitutions()
  }

  const filtered = institutions.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">
          Instituciones
        </h1>
        <Button variant="accent" onClick={openCreate}>
          + Nueva Institución
        </Button>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative max-w-md">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-text-body">
                <th className="px-4 py-3 font-medium">Institución</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium text-center">Carreras</th>
                <th className="px-4 py-3 font-medium text-center">Preguntas</th>
                <th className="px-4 py-3 font-medium text-center">Activa</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    {search
                      ? 'No se encontraron resultados'
                      : 'No hay instituciones. Crea la primera.'}
                  </td>
                </tr>
              ) : (
                filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {inst.logo_url ? (
                          <img
                            src={inst.logo_url}
                            alt=""
                            className="h-9 w-9 rounded object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {inst.name
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <Link
                          to={`/admin/institutions/${inst.id}/programs`}
                          className="font-medium text-text-main hover:text-primary transition-colors"
                        >
                          {inst.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-body font-mono text-xs">
                      {inst.slug}
                    </td>
                    <td className="px-4 py-3 text-center">{inst.programCount}</td>
                    <td className="px-4 py-3 text-center">{inst.questionCount}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(inst)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          inst.is_active ? 'bg-success' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            inst.is_active ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(inst)}
                          className="text-text-muted hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <Link
                          to={`/admin/institutions/${inst.id}/programs`}
                          className="text-text-muted hover:text-accent transition-colors"
                          title="Ver carreras"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(inst)}
                          className="text-text-muted hover:text-danger transition-colors"
                          title="Eliminar"
                        >
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
      </Card>

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Institución' : 'Nueva Institución'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Instituto Politécnico Nacional"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Slug <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="instituto-politecnico-nacional"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm font-mono text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <p className="text-xs text-text-muted mt-1">
              Solo minúsculas, números y guiones
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Logo URL
            </label>
            <input
              type="text"
              value={form.logo_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, logo_url: e.target.value }))
              }
              placeholder="https://..."
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Configuración JSON
            </label>
            <textarea
              value={form.config_json}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, config_json: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm font-mono text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setForm((prev) => ({ ...prev, is_active: !prev.is_active }))
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-success' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-text-body">Activa</span>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar institución"
        message={`Se eliminará "${deleteTarget?.name}" y todas sus carreras, exámenes y preguntas asociadas. Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </div>
  )
}
