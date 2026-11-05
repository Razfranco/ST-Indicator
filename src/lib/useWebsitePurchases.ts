import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
export type WebsiteOrder = {
  id: string
  order_number: number
  full_name: string
  email: string
  phone: string
  street: string | null
  city: string | null
  tradingview_username: string | null
  product_name: string
  product_slug: string
  amount: number
  list_price: number
  coupon_code: string | null
  status: string
  paid_at: string | null
  created_at: string
  installments_chosen: number | null
  course: boolean
}
export type WebsiteTrial = {
  id: string
  order_id: string
  code: string
  days: number
  redeemed_at: string | null
  expires_at: string | null
  tradingview_username: string | null
  notified_at: string | null
  access_granted_at: string | null
  access_removed_at: string | null
  archived_at?: string | null
}
export type WebsiteData = {
  orders: WebsiteOrder[]
  trials: WebsiteTrial[]
  asOf: string
}
const endpoint = 'https://sharktradebom.com/api/business-platform'
export async function websiteRequest(action?: {
  id: string
  action: 'grant' | 'remove' | 'retry' | 'archive'
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('נדרשת התחברות מחדש')
  const r = await fetch(endpoint, {
    method: action ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + session.access_token,
      ...(action ? { 'Content-Type': 'application/json' } : {}),
    },
    body: action ? JSON.stringify(action) : undefined,
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? 'אין הרשאת ניהול עסקית או שההתחברות פגה'
        : 'החיבור לנתוני האתר אינו זמין כרגע. הנתונים הקיימים נשמרו.',
    )
  return r.json()
}
export function useWebsitePurchases() {
  const [data, setData] = useState<WebsiteData>({
      orders: [],
      trials: [],
      asOf: '',
    }),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try {
      setData(await websiteRequest())
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30000)
    return () => clearInterval(id)
  }, [refresh])
  return { ...data, error, loading, refresh }
}
