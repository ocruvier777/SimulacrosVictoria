import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const emptyForm = {
  code: '',
  name: '',
  description: '',
  is_active: true,
}

export default function InstitutionPrograms() {
  const { institutionId } = useParams()
  const toast = useToast()

  const [institution, setInstitution] = useState(null)
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [institutionId])

  const loadData = async () => {
    const [{ data: inst }, { data: progs }] = await Promise.all([
      supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single(),
      supabase
        .from('programs')
        .select('*, program_subjects(count), exams(count)')
        .eq('institution_id', institutionId)
        .order('name'),
    ])

    setInstitution(inst)
    setPrograms(
      (progs || []).map((p) => ({
        ...p,
        subjectCount: p.program_subjects?.[0]?.count || 0,
        examCount: p.exams?.[0]?.count || 0,
      }))
    )
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (prog) => {
    setEditing(prog)
    setForm({
      code: prog.code,
      name: prog.name,
      description: prog.description || '',
      is_active: prog.is_active,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.code.trim()) {
      setFormError('El código es obligatorio')
      return
    }
    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      institution_id: institutionId,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    }

    if (editing) {
      const { error } = await supabase
        .from('programs')
        .update(payload)
        .eq('id', editing.id)

      if (error) {
        setFormError(error.message)
        setSaving(false)
        return
      }
      toast('Carrera actualizada', 'success')
    } else {
      const { error } = await supabase.from('programs').insert(payload)

      if (error) {
        setFormError(error.message)
        setSaving(false)
        return
      }
      toast('Carrera creada', 'success')
    }

    setSaving(false)
    setModalOpen(false)
    loadData()
  }

  const handleToggleActive = async (prog) => {
    const { error } = await supabase
      .from('programs')
      .update({ is_active: !prog.is_active })
      .eq('id', prog.id)

    if (error) {
      toast('Error al actualizar estado', 'error')
      return
    }

    setPrograms((prev) =>
      prev.map((p) =>
        p.id === prog.id ? { ...p, is_active: !p.is_active } : p
      )
    )
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }

    toast('Carrera eliminada', 'success')
    setDeleting(false)
    setDeleteTarget(null)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-text-body flex items-center gap-1.5 flex-wrap">
        <Link
          to="/admin/institutions"
          className="hover:text-primary transition-colors"
        >
          Instituciones
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-main font-medium">{institution?.name}</span>
        <span className="text-text-muted">/</span>
        <span className="text-text-main font-medium">Carreras</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-text-main">
          Carreras
        </h1>
        <Button variant="accent" onClick={openCreate}>
          + Nueva Carrera
        </Button>
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-text-body">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium text-center">Materias</th>
                <th className="px-4 py-3 font-medium text-center">Exámenes</th>
                <th className="px-4 py-3 font-medium text-center">Activa</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    No hay carreras para esta institución.
                  </td>
                </tr>
              ) : (
                programs.map((prog) => (
                  <tr key={prog.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary">
                      {prog.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-main">
                      {prog.name}
                    </td>
                    <td className="px-4 py-3 text-center">{prog.subjectCount}</td>
                    <td className="px-4 py-3 text-center">{prog.examCount}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(prog)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          prog.is_active ? 'bg-success' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            prog.is_active ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(prog)}
                          className="text-text-muted hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <Link
                          to={`/admin/institutions/${institutionId}/programs/${prog.id}/subjects`}
                          className="text-text-muted hover:text-accent transition-colors"
                          title="Ver materias"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(prog)}
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
        title={editing ? 'Editar Carrera' : 'Nueva Carrera'}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Institución
            </label>
            <input
              type="text"
              value={institution?.name || ''}
              disabled
              className="w-full px-3 py-2 rounded border border-gray-200 bg-gray-50 text-sm text-text-body"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Código <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder='Ej: "EMM", "ESCA"'
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ej: Escuela Militar de Medicina"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              placeholder="Descripción de la carrera (opcional)"
              className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y"
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
        title="Eliminar carrera"
        message={`Se eliminará "${deleteTarget?.name}" y todos sus exámenes, materias y preguntas. Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </div>
  )
}
