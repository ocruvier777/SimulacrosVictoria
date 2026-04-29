export default function AdminPlaceholder({ title }) {
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold text-text-main">
        {title}
      </h1>
      <p className="text-text-body mt-2">Próximamente...</p>
    </div>
  )
}
