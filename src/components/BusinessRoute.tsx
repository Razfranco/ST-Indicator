import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function BusinessRoute({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (!profile?.business_access) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
