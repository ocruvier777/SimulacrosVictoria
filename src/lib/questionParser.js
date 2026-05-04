export function parseTextToQuestions(text, defaultSubject = '') {
  const lines = text.split('\n')
  const questions = []
  let currentSubject = defaultSubject
  let current = null
  let collectingJustification = false

  const pushCurrent = () => {
    if (!current) return
    current.question_text = current.question_text.trim()
    current.justification = current.justification.trim()
    current.options = current.options.map((o) => ({ ...o, text: o.text.trim() }))
    questions.push(current)
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detectar secciones: "SECCIÓN: Álgebra" o "--- Álgebra ---"
    const sectionMatch =
      trimmed.match(/^(?:SECCI[OÓ]N|Secci[oó]n)\s*:\s*(.+)$/i) ||
      trimmed.match(/^-{3,}\s*(.+?)\s*-{3,}$/)
    if (sectionMatch) {
      pushCurrent()
      currentSubject = sectionMatch[1].trim()
      continue
    }

    // Detectar número de pregunta: "1. Texto..."
    const questionMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (questionMatch) {
      pushCurrent()
      current = {
        subject: currentSubject,
        question_text: questionMatch[2],
        options: [],
        correct_answer: '',
        justification: '',
      }
      collectingJustification = false
      continue
    }

    // Detectar opción: "A) Texto" o "A) Texto *"
    const optionMatch = trimmed.match(/^([A-D])\)\s+(.+)$/)
    if (optionMatch && current) {
      let optText = optionMatch[2]
      const isCorrect = optText.endsWith('*')
      if (isCorrect) {
        optText = optText.slice(0, -1).trim()
        current.correct_answer = optionMatch[1]
      }
      current.options.push({ key: optionMatch[1], text: optText })
      collectingJustification = false
      continue
    }

    // Detectar justificación
    const justMatch = trimmed.match(/^[Jj]ustificaci[oó]n\s*:\s*(.*)$/i)
    if (justMatch && current) {
      current.justification = justMatch[1]
      collectingJustification = true
      continue
    }

    // Líneas de continuación
    if (current) {
      if (collectingJustification) {
        current.justification += '\n' + trimmed
      } else if (current.options.length === 0) {
        current.question_text += '\n' + trimmed
      }
    }
  }

  pushCurrent()
  return questions
}

export function validateParsedQuestions(questions) {
  return questions.map((q, i) => {
    const errors = []
    if (!q.question_text) errors.push('Sin texto')
    if (q.options.length < 3) errors.push(`Solo ${q.options.length} opciones`)
    if (!q.correct_answer) errors.push('Sin respuesta correcta')
    if (!q.subject) errors.push('Sin materia')
    return { ...q, _index: i + 1, _errors: errors, _valid: errors.length === 0 }
  })
}
