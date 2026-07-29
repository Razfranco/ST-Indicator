import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Lead } from '../types/business.types'

function sortByCreated(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** טוען את הלידים ומחזיק אותם מסונכרנים בזמן אמת דרך Supabase Realtime */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Lead
            setLeads((prev) => (prev.some((l) => l.id === inserted.id) ? prev : sortByCreated([...prev, inserted])))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Lead
            setLeads((prev) => sortByCreated(prev.map((l) => (l.id === updated.id ? updated : l))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Lead>).id
            setLeads((prev) => prev.filter((l) => l.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('leads')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setLeads(sortByCreated(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { leads, loading, error }
}
