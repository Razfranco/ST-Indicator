import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 shadow-lg">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-border">
          <img src="/icons/icon-512.png" alt="Shark Trade Indicator" className="h-full w-full object-contain" />
        </div>
        <h1 className="mb-1 text-center font-heading text-2xl font-semibold text-foreground" dir="ltr">
          ST Indicator
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? 'התחברות לחשבון שלך' : 'יצירת חשבון חדש'}
        </p>

        <CardContent className="px-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-left"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-left"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-destructive">{error}</AlertDescription>
              </Alert>
            )}
            {info && (
              <Alert>
                <AlertDescription className="text-primary">{info}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={submitting} size="lg" className="mt-2">
              {submitting ? 'רגע...' : mode === 'signin' ? 'התחברות' : 'הרשמה'}
            </Button>
          </form>

          <Button
            type="button"
            variant="link"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setInfo(null)
            }}
            className="mt-4 w-full text-center text-muted-foreground"
          >
            {mode === 'signin' ? 'אין לך חשבון? הרשמה' : 'יש לך כבר חשבון? התחברות'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
