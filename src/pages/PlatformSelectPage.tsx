import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function PlatformSelectPage() {
  const { profile, signOut } = useAuth()

  const platforms = [
    { to: '/performance', label: 'דשבורד ביצועים', description: 'עסקאות, דשבורד ודוחות מסחר', icon: ChartIcon, available: true },
    {
      to: '/business/customers',
      label: 'ניהול עסקי',
      description: 'לקוחות, לידים, הוצאות ותזרים',
      icon: BriefcaseIcon,
      available: Boolean(profile?.business_access),
    },
  ].filter((p) => p.available)

  if (platforms.length === 1) {
    return <Navigate to={platforms[0].to} replace />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-950 px-6 text-zinc-100">
      <div className="flex flex-col items-center gap-2">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
          <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-xl font-bold" dir="ltr">ST Indicator</h1>
        <p className="text-sm text-zinc-400">בחר/י פלטפורמה להמשך</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
        {platforms.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center transition hover:border-emerald-500 hover:bg-zinc-900"
          >
            <div className="rounded-full bg-emerald-950 p-3 text-emerald-400">
              <p.icon />
            </div>
            <div>
              <div className="font-semibold text-zinc-100">{p.label}</div>
              <div className="mt-1 text-xs text-zinc-500">{p.description}</div>
            </div>
          </Link>
        ))}
      </div>

      <button
        onClick={() => signOut()}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        יציאה
      </button>
    </div>
  )
}

function ChartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BriefcaseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
