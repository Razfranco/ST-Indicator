import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function PerformanceRoute({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (!profile?.approved && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
