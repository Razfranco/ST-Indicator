import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Customer } from '../types/business.types'

function sortByName(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))
}

/** טוען את הלקוחות ומחזיק אותם מסונכרנים בזמן אמת דרך Supabase Realtime */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Customer
            setCustomers((prev) =>
              prev.some((c) => c.id === inserted.id) ? prev : sortByName([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Customer
            setCustomers((prev) => sortByName(prev.map((c) => (c.id === updated.id ? updated : c))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Customer>).id
            setCustomers((prev) => prev.filter((c) => c.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('customers')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setCustomers(sortByName(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { customers, loading, error }
}
