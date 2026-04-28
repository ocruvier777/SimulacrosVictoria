import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

// Hook para acceder al contexto de autenticación
// TODO: agregar funciones de login, logout, registro
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
