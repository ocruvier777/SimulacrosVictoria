const variants = {
  primary: 'bg-primary hover:bg-primary-dark text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-text-main',
  accent: 'bg-accent hover:bg-accent-dark text-white',
  danger: 'bg-danger hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 text-text-body',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  className = '',
  ...props
}) {
  return (
    <button
      className={`rounded font-display font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
      )}
      {children}
    </button>
  )
}
