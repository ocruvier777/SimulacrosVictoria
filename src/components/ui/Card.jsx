// Card reutilizable del design system
// Estilo: border 1px solid #E5E5E5, fondo blanco, padding 16px, glassmorphism sutil
// TODO: variantes (default, glass, elevated)
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-bg-main border border-gray-200 rounded p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
