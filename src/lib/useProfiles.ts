import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Profile } from '../types/database.types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('profiles-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Profile
            setProfiles((prev) => (prev.some((p) => p.id === inserted.id) ? prev : [...prev, inserted]))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Profile
            setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Profile>).id
            setProfiles((prev) => prev.filter((p) => p.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setProfiles(data ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { profiles, loading, error }
}
