import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { TreasuryTransaction } from '../types/business.types'

function sortByDate(transactions: TreasuryTransaction[]): TreasuryTransaction[] {
  return [...transactions].sort(
    (a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at),
  )
}

/** טוען את תנועות הקופה ומחזיק אותן מסונכרנות בזמן אמת דרך Supabase Realtime */
export function useTreasuryTransactions() {
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('treasury-transactions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_transactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as TreasuryTransaction
            setTransactions((prev) =>
              prev.some((t) => t.id === inserted.id) ? prev : sortByDate([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TreasuryTransaction
            setTransactions((prev) => sortByDate(prev.map((t) => (t.id === updated.id ? updated : t))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<TreasuryTransaction>).id
            setTransactions((prev) => prev.filter((t) => t.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('treasury_transactions')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setTransactions(sortByDate(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { transactions, loading, error }
}
