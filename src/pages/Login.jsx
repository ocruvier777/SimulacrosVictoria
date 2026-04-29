import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { user, loading: authLoading, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      console.error('[Login] signIn error:', err)
      setError(
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : 'Error al iniciar sesión. Intenta de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('[Login] Google auth error:', err)
      setError('Error al conectar con Google')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary px-4">
      <div className="glass rounded-lg p-8 w-full max-w-md animate-fade-in shadow-lg">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">
            VictoriaEdu
          </h1>
          <p className="text-text-body text-sm mt-1">
            Plataforma de Exámenes Simulacro
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-main mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full pl-10 pr-4 py-2.5 rounded border border-gray-300 bg-white text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-main mb-1">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-2.5 rounded border border-gray-300 bg-white text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-body transition-colors"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-primary hover:bg-primary-dark text-white font-display font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            Iniciar Sesión
          </button>
        </form>

        {/* Separador */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-3 text-text-muted text-xs">o</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="w-full py-2.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-text-main font-display font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        {/* Link a registro */}
        <p className="text-center text-sm text-text-body mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary hover:text-primary-dark font-semibold transition-colors">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
