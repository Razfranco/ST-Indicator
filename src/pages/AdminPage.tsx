import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useProfiles } from '../lib/useProfiles'
import { useAuth } from '../context/AuthContext'

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

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען משתמשים...</p>
  }

  const sorted = [...profiles].sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1
    return a.created_at.localeCompare(b.created_at)
  })

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h2 className="text-xl font-bold">ניהול משתמשים</h2>

      {(error || actionError) && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error ?? actionError}</p>
      )}

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין משתמשים להצגה.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-200" dir="ltr">
                  {p.email}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{p.role === 'admin' ? 'מנהל' : 'משתמש'}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      p.approved ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                    }`}
                  >
                    {p.approved ? 'מאושר' : 'ממתין לאישור'}
                  </span>
                  {p.business_access && (
                    <span className="rounded bg-sky-950 px-1.5 py-0.5 font-semibold text-sky-400">
                      גישה עסקית
                    </span>
                  )}
                  {p.id === user?.id && <span className="text-zinc-600">(אתה)</span>}
                </div>
              </div>

              {p.id !== user?.id && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleBusinessAccess(p.id, p.business_access)}
                    disabled={updatingId === p.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                      p.business_access
                        ? 'border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400'
                        : 'bg-sky-600 text-white hover:bg-sky-500'
                    }`}
                  >
                    {p.business_access ? 'ביטול גישה עסקית' : 'הענקת גישה עסקית'}
                  </button>
                  <button
                    onClick={() => toggleApproved(p.id, p.approved)}
                    disabled={updatingId === p.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                      p.approved
                        ? 'border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {p.approved ? 'ביטול גישה' : 'אישור גישה'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
