// Modal reutilizable del design system
// TODO: overlay con backdrop, animación de entrada/salida,
//       cerrar con Escape y click fuera, portal con createPortal
export default function Modal({ open, onClose, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative glass rounded p-6 w-full max-w-md animate-slide-up">
        {children}
      </div>
    </div>
  )
}
