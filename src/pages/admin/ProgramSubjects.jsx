import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function ProgramSubjects() {
  const { institutionId, programId } = useParams()
  const toast = useToast()

  const [institution, setInstitution] = useState(null)
  const [program, setProgram] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    loadData()
  }, [institutionId, programId])

  const loadData = async () => {
    const [{ data: inst }, { data: prog }, { data: subs }] = await Promise.all([
      supabase
        .from('institutions')
        .select('id, name')
        .eq('id', institutionId)
        .single(),
      supabase
        .from('programs')
        .select('id, name, code')
        .eq('id', programId)
        .single(),
      supabase
        .from('program_subjects')
        .select('*')
        .eq('program_id', programId)
        .order('order_index'),
    ])

    setInstitution(inst)
    setProgram(prog)
    setSubjects((subs || []).map((s) => ({ ...s, _original: true })))
    setHasChanges(false)
    setLoading(false)
  }

  const addRow = () => {
    setSubjects((prev) => [
      ...prev,
      {
        _tempId: Date.now(),
        program_id: programId,
        name: '',
        question_count: 0,
        icon: '📌',
        order_index: prev.length,
        _original: false,
      },
    ])
    setHasChanges(true)
  }

  const updateRow = (index, field, value) => {
    setSubjects((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
    setHasChanges(true)
  }

  const removeRow = (index) => {
    const subject = subjects[index]
    if (subject._original) {
      setDeleteTarget({ index, subject })
    } else {
      setSubjects((prev) => prev.filter((_, i) => i !== index))
      setHasChanges(true)
    }
  }

  const confirmRemoveRow = () => {
    if (!deleteTarget) return
    setSubjects((prev) => prev.filter((_, i) => i !== deleteTarget.index))
    setHasChanges(true)
    setDeleteTarget(null)
  }

  const handleSave = async () => {
    const invalid = subjects.find((s) => !s.name.trim())
    if (invalid) {
      toast('Todas las materias deben tener nombre', 'error')
      return
    }

    setSaving(true)

    // Borrar todas las materias del programa y reinsertar
    const { error: deleteError } = await supabase
      .from('program_subjects')
      .delete()
      .eq('program_id', programId)

    if (deleteError) {
      toast('Error al guardar: ' + deleteError.message, 'error')
      setSaving(false)
      return
    }

    if (subjects.length > 0) {
      const rows = subjects.map((s, i) => ({
        program_id: programId,
        name: s.name.trim(),
        question_count: parseInt(s.question_count) || 0,
        icon: s.icon || '📌',
        order_index: i,
      }))

      const { error: insertError } = await supabase
        .from('program_subjects')
        .insert(rows)

      if (insertError) {
        toast('Error al guardar: ' + insertError.message, 'error')
        setSaving(false)
        return
      }
    }

    toast('Materias guardadas', 'success')
    setSaving(false)
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
        <Link
          to={`/admin/institutions/${institutionId}/programs`}
          className="hover:text-primary transition-colors"
        >
          {institution?.name}
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-main font-medium">
          {program?.code} — Materias
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">
            Materias
          </h1>
          <p className="text-sm text-text-body mt-1">{program?.name}</p>
        </div>
        {hasChanges && (
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        )}
      </div>

      {/* Tabla editable inline */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-text-body">
                <th className="px-4 py-3 font-medium w-16 text-center">
                  Icono
                </th>
                <th className="px-4 py-3 font-medium">Nombre de la materia</th>
                <th className="px-4 py-3 font-medium w-32 text-center">
                  Preguntas/examen
                </th>
                <th className="px-4 py-3 font-medium w-20 text-center">
                  Orden
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjects.map((subject, index) => (
                <tr
                  key={subject.id || subject._tempId}
                  className="hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2 text-center">
                    <input
                      type="text"
                      value={subject.icon}
                      onChange={(e) =>
                        updateRow(index, 'icon', e.target.value)
                      }
                      className="w-10 text-center text-lg px-1 py-1 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={subject.name}
                      onChange={(e) =>
                        updateRow(index, 'name', e.target.value)
                      }
                      placeholder="Nombre de la materia"
                      className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={subject.question_count}
                      onChange={(e) =>
                        updateRow(index, 'question_count', e.target.value)
                      }
                      className="w-20 text-center px-2 py-1.5 rounded border border-gray-200 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={subject.order_index}
                      onChange={(e) =>
                        updateRow(index, 'order_index', e.target.value)
                      }
                      className="w-16 text-center px-2 py-1.5 rounded border border-gray-200 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      className="text-text-muted hover:text-danger transition-colors"
                      title="Eliminar"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}

              {/* Fila para agregar */}
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  <button
                    onClick={addRow}
                    className="text-sm text-primary hover:text-primary-dark transition-colors font-medium flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Agregar materia
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {subjects.length > 0 && (
        <div className="text-sm text-text-muted">
          Total de preguntas por examen:{' '}
          <span className="font-medium text-text-main">
            {subjects.reduce(
              (sum, s) => sum + (parseInt(s.question_count) || 0),
              0
            )}
          </span>
        </div>
      )}

      {/* Confirm delete materia existente */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveRow}
        title="Eliminar materia"
        message={`Se eliminará "${deleteTarget?.subject?.name}". Recuerda guardar los cambios después.`}
        confirmLabel="Quitar"
      />
    </div>
  )
}
