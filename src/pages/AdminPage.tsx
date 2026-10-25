import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useProfiles } from '../lib/useProfiles'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'

export function AdminPage() {
  const { profiles, loading, error } = useProfiles()
  const { user } = useAuth()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function toggleApproved(id: string, approved: boolean) {
    setUpdatingId(id)
    setActionError(null)
    const { error } = await supabase.from('profiles').update({ approved: !approved }).eq('id', id)
    setUpdatingId(null)
    if (error) setActionError(error.message)
  }

  async function toggleBusinessAccess(id: string, businessAccess: boolean) {
    setUpdatingId(id)
    setActionError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ business_access: !businessAccess })
      .eq('id', id)
    setUpdatingId(null)
    if (error) setActionError(error.message)
  }

  async function toggleMentorAccess(id: string, mentorAccess: boolean) {
    setUpdatingId(id)
    setActionError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ mentor_access: !mentorAccess })
      .eq('id', id)
    setUpdatingId(null)
    if (error) setActionError(error.message)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 pb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const sorted = [...profiles].sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1
    return a.created_at.localeCompare(b.created_at)
  })

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h2 className="font-heading text-xl font-semibold">ניהול משתמשים</h2>

      {(error || actionError) && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error ?? actionError}</AlertDescription>
        </Alert>
      )}

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">אין משתמשים להצגה.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((p) => (
            <Card key={p.id} className="flex-row flex-wrap items-center justify-between gap-3 p-3 shadow-sm">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground" dir="ltr">
                  {p.email}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{p.role === 'admin' ? 'מנהל' : 'משתמש'}</span>
                  <Badge
                    variant="outline"
                    className={
                      p.approved
                        ? 'border-transparent bg-primary/10 text-primary'
                        : 'border-transparent bg-amber-100 text-amber-800'
                    }
                  >
                    {p.approved ? 'מאושר' : 'ממתין לאישור'}
                  </Badge>
                  {p.business_access && (
                    <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800">
                      גישה עסקית
                    </Badge>
                  )}
                  {p.mentor_access && (
                    <Badge variant="outline" className="border-transparent bg-violet-100 text-violet-800">
                      גישת מנטורינג
                    </Badge>
                  )}
                  {p.id === user?.id && <span className="text-muted-foreground/70">(אתה)</span>}
                </div>
              </div>

              {p.id !== user?.id && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    variant={p.mentor_access ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleMentorAccess(p.id, p.mentor_access)}
                    disabled={updatingId === p.id}
                    className={p.mentor_access ? '' : 'bg-violet-700 text-white hover:bg-violet-600'}
                  >
                    {p.mentor_access ? 'ביטול גישת מנטורינג' : 'הענקת גישת מנטורינג'}
                  </Button>
                  <Button
                    variant={p.business_access ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleBusinessAccess(p.id, p.business_access)}
                    disabled={updatingId === p.id}
                    className={p.business_access ? '' : 'bg-sky-700 text-white hover:bg-sky-600'}
                  >
                    {p.business_access ? 'ביטול גישה עסקית' : 'הענקת גישה עסקית'}
                  </Button>
                  <Button
                    variant={p.approved ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleApproved(p.id, p.approved)}
                    disabled={updatingId === p.id}
                  >
                    {p.approved ? 'ביטול גישה' : 'אישור גישה'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
