import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, profile, profileLoading, signOut } = useAuth()

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        טוען...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.approved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
        <div className="rounded-full bg-amber-950 p-3 text-amber-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-zinc-100">החשבון שלך ממתין לאישור</h1>
        <p className="max-w-sm text-sm text-zinc-400" dir="ltr">
          {session.user.email}
        </p>
        <p className="max-w-sm text-sm text-zinc-500">
          פנה/י למנהל הפלטפורמה כדי לקבל גישה. ברגע שתאושר, המסך הזה יתעדכן אוטומטית.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
        >
          יציאה
        </button>
      </div>
    )
  }

  return <>{children}</>
}
