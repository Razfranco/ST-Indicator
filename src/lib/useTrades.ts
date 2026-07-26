import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Trade } from '../types/database.types'

function sortByEntryDatetime(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.entry_datetime).getTime() - new Date(b.entry_datetime).getTime(),
  )
}

/**
 * טוען את העסקאות ומחזיק אותן מסונכרנות בזמן אמת דרך Supabase Realtime,
 * כך שעדכון ממכשיר אחד (למשל הזנה מהנייד) מופיע מיידית בכל מכשיר אחר
 * שפתוח על אותו חשבון, בלי צורך ברענון.
 */
export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Trade
            setTrades((prev) =>
              prev.some((t) => t.id === inserted.id) ? prev : sortByEntryDatetime([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Trade
            setTrades((prev) => sortByEntryDatetime(prev.map((t) => (t.id === updated.id ? updated : t))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Trade>).id
            setTrades((prev) => prev.filter((t) => t.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('trades')
      .select('*')
      .order('entry_datetime', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setTrades(data ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { trades, loading, error }
}
