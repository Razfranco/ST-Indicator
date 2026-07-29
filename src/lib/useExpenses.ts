import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { AdditionalExpense } from '../types/business.types'

function sortByMonth(expenses: AdditionalExpense[]): AdditionalExpense[] {
  return [...expenses].sort(
    (a, b) => b.expense_month.localeCompare(a.expense_month) || b.created_at.localeCompare(a.created_at),
  )
}

/** טוען את ההוצאות הנוספות ומחזיק אותן מסונכרנות בזמן אמת דרך Supabase Realtime */
export function useExpenses() {
  const [expenses, setExpenses] = useState<AdditionalExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('additional-expenses-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'additional_expenses' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as AdditionalExpense
            setExpenses((prev) =>
              prev.some((e) => e.id === inserted.id) ? prev : sortByMonth([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AdditionalExpense
            setExpenses((prev) => sortByMonth(prev.map((e) => (e.id === updated.id ? updated : e))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<AdditionalExpense>).id
            setExpenses((prev) => prev.filter((e) => e.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('additional_expenses')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setExpenses(sortByMonth(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { expenses, loading, error }
}
