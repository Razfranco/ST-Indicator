import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { FixedExpense } from '../types/business.types'

function sortByName(expenses: FixedExpense[]): FixedExpense[] {
  return [...expenses].sort((a, b) => a.expense_name.localeCompare(b.expense_name, 'he'))
}

/** טוען את ההוצאות הקבועות (כללים חוזרים) ומחזיק אותן מסונכרנות בזמן אמת */
export function useFixedExpenses() {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('fixed-expenses-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fixed_expenses' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as FixedExpense
            setFixedExpenses((prev) =>
              prev.some((e) => e.id === inserted.id) ? prev : sortByName([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as FixedExpense
            setFixedExpenses((prev) => sortByName(prev.map((e) => (e.id === updated.id ? updated : e))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<FixedExpense>).id
            setFixedExpenses((prev) => prev.filter((e) => e.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('fixed_expenses')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setFixedExpenses(sortByName(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { fixedExpenses, loading, error }
}
