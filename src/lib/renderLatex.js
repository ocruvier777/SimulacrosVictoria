import katex from 'katex'
import 'katex/dist/katex.min.css'

export function renderLatex(text) {
  if (!text) return ''

  // $$...$$ display math
  let result = text.replace(/\$\$([^$]+?)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return match
    }
  })

  // $...$ inline math — skip if content is only digits (prices like $199)
  result = result.replace(/\$([^$]+?)\$/g, (match, formula) => {
    if (/^[\d.,\s]+$/.test(formula)) return match
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return match
    }
  })

  return result
}

export function stripLatex(text) {
  if (!text) return ''
  return text
    .replace(/\$\$([^$]+?)\$\$/g, '$1')
    .replace(/\$([^$]+?)\$/g, '$1')
    .replace(/\\(?:frac|sqrt|text|mathbf|mathrm)\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}^_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
