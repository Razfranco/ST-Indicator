import { Navigate, Link } from 'react-router-dom'
import { BarChart3, Briefcase, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'

export function PlatformSelectPage() {
  const { profile, signOut } = useAuth()

  const platforms = [
    {
      to: '/performance',
      label: 'דשבורד ביצועים',
      description: 'עסקאות, דשבורד ודוחות מסחר',
      icon: BarChart3,
      available: Boolean(profile?.approved) || profile?.role === 'admin',
    },
    {
      to: '/business/customers',
      label: 'ניהול עסקי',
      description: 'לקוחות, לידים, הוצאות ותזרים',
      icon: Briefcase,
      available: Boolean(profile?.business_access),
    },
    {
      to: '/mentoring/meetings',
      label: 'מנטורינג',
      description: 'תלמידים, שיוכים ופגישות ליווי',
      icon: GraduationCap,
      available: Boolean(profile?.mentor_access) || profile?.role === 'admin',
    },
  ].filter((p) => p.available)

  if (platforms.length === 1) {
    return <Navigate to={platforms[0].to} replace />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-border">
          <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
        </div>
        <h1 className="font-heading text-xl font-semibold" dir="ltr">
          ST Indicator
        </h1>
        <p className="text-sm text-muted-foreground">בחר/י פלטפורמה להמשך</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
        {platforms.map((p) => (
          <Link key={p.to} to={p.to}>
            <Card className="h-full items-center gap-3 p-6 text-center shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <p.icon className="h-7 w-7" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{p.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Button variant="outline" onClick={() => signOut()}>
        יציאה
      </Button>
    </div>
  )
}
