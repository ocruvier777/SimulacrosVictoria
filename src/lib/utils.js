// Helpers generales de la aplicación
// TODO: formateo de tiempo, manejo de errores, validaciones comunes

export function formatTiempo(segundos) {
  const min = Math.floor(segundos / 60)
  const seg = segundos % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
