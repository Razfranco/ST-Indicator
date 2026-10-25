import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, profile, profileLoading, signOut } = useAuth()

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-background text-muted-foreground">
        טוען...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const hasAnyAccess =
    profile?.approved || profile?.business_access || profile?.mentor_access || profile?.role === 'admin'

  if (!hasAnyAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="rounded-full bg-amber-100 p-3 text-amber-800">
          <TriangleAlert className="h-7 w-7" />
        </div>
        <h1 className="font-heading text-lg font-semibold text-foreground">החשבון שלך ממתין לאישור</h1>
        <p className="max-w-sm text-sm text-muted-foreground" dir="ltr">
          {session.user.email}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          פנה/י למנהל הפלטפורמה כדי לקבל גישה. ברגע שתאושר, המסך הזה יתעדכן אוטומטית.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => signOut()}>
          יציאה
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
