// Botón reutilizable del design system
// Variantes: primary, secondary, accent, danger, ghost
// Tamaños: sm, md, lg
// TODO: implementar variantes con Tailwind
export default function Button({ children, ...props }) {
  return (
    <button
      className="px-4 py-2 rounded font-display font-semibold text-sm transition-colors"
      {...props}
    >
      {children}
    </button>
  )
}
