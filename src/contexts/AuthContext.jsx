import { createContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

// Provider de autenticación con Supabase Auth
// TODO: manejar sesión, login con Google, login con email/password,
//       registro, logout, y estados de carga
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: suscribirse a cambios de auth con supabase.auth.onAuthStateChange
    setLoading(false)
  }, [])

  const value = {
    user,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
