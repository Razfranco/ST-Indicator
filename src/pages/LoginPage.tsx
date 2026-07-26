import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { session, signInWithPassword, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const action = mode === 'signin' ? signInWithPassword : signUp
    const { error } = await action(email, password)

    if (error) {
      setError(error)
    } else if (mode === 'signup') {
      setInfo('נרשמת בהצלחה. אם נדרש אימות אימייל — בדוק/י את תיבת הדואר שלך ואז התחבר/י.')
      setMode('signin')
    }

    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
          <img src="/icons/icon-512.png" alt="Shark Trade Indicator" className="h-full w-full object-contain" />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-zinc-50" dir="ltr">ST Indicator</h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          {mode === 'signin' ? 'התחברות לחשבון שלך' : 'יצירת חשבון חדש'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-400">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? 'רגע...' : mode === 'signin' ? 'התחברות' : 'הרשמה'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
          className="mt-4 w-full text-center text-sm text-zinc-400 hover:text-zinc-200"
        >
          {mode === 'signin' ? 'אין לך חשבון? הרשמה' : 'יש לך כבר חשבון? התחברות'}
        </button>
      </div>
    </div>
  )
}
