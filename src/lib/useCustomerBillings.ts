import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { CustomerBilling } from '../types/business.types'

function sortByMonth(billings: CustomerBilling[]): CustomerBilling[] {
  return [...billings].sort((a, b) => b.billing_month.localeCompare(a.billing_month))
}

/** טוען את כל החיובים (לכל הלקוחות) ומחזיק אותם מסונכרנים בזמן אמת — משמש
 * גם להיסטוריית חיובים של לקוח בודד וגם לצבירת תזרים חודשי */
export function useCustomerBillings() {
  const [billings, setBillings] = useState<CustomerBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('customer-billings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_billings' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as CustomerBilling
            setBillings((prev) =>
              prev.some((b) => b.id === inserted.id) ? prev : sortByMonth([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CustomerBilling
            setBillings((prev) => sortByMonth(prev.map((b) => (b.id === updated.id ? updated : b))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<CustomerBilling>).id
            setBillings((prev) => prev.filter((b) => b.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('customer_billings')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setBillings(sortByMonth(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { billings, loading, error }
}
