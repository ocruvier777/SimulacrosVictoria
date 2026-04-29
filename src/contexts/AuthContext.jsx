import { createContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (err) {
      console.error('Error al obtener perfil:', err.message)
      return null
    }
    return data
  }, [])

  // Efecto 1: solo rastrear estado de auth (sin queries a DB en el callback)
  useEffect(() => {
    // PKCE: limpiar code de la URL antes de que React strict mode re-ejecute
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const initAuth = async () => {
      if (code) {
        console.log('[Auth] Exchanging PKCE code for session...')
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('[Auth] Code exchange failed:', exchangeError.message)
        }
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[Auth] getSession error:', sessionError.message)
      }
      console.log('[Auth] Initial session:', session?.user?.email ?? 'none')
      setUser(session?.user ?? null)
      if (!session?.user) setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return
        console.log('[Auth] State change:', event, session?.user?.email ?? 'none')
        setUser(session?.user ?? null)
        if (!session?.user) {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Efecto 2: cargar perfil cuando user cambia
  useEffect(() => {
    if (!user) return

    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (cancelled) return
      console.log('[Auth] Profile loaded:', p?.role ?? 'no profile')
      setProfile(p)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [user, fetchProfile])

  const signIn = async (email, password) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (err) {
      setError(err.message)
      throw err
    }
  }

  const signUp = async (email, password, metadata = {}) => {
    setError(null)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    if (err) {
      setError(err.message)
      throw err
    }
  }

  const signInWithGoogle = async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (err) {
      setError(err.message)
      throw err
    }
  }

  const signOut = async () => {
    setError(null)
    const { error: err } = await supabase.auth.signOut()
    if (err) {
      setError(err.message)
      throw err
    }
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    error,
    isAdmin: profile?.role === 'admin',
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
