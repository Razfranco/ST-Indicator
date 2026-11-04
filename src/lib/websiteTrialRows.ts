import type { Lead } from '../types/business.types'
import type { WebsiteOrder, WebsiteTrial } from './useWebsitePurchases'

/** Display canonical website records without copying them into the legacy leads table. */
export function grantedTrialRows(orders: WebsiteOrder[], trials: WebsiteTrial[]): Lead[] {
  const byId = new Map(orders.map(order => [order.id, order]))
  return trials.flatMap(trial => {
    const order = byId.get(trial.order_id)
    if (!order || !trial.redeemed_at || !trial.access_granted_at) return []
    return [{
      id: 'website-trial:' + trial.id,
      created_at: trial.redeemed_at,
      full_name: order.full_name,
      phone: order.phone,
      source: 'מימוש קופון קורס דיגיטלי',
      status: 'trial_week' as const,
      trial_week_expiry: trial.expires_at,
      follow_up: null,
      follow_up_at: null,
      handled: !!trial.access_removed_at,
      note: [
        order.email,
        'TradingView: ' + (trial.tradingview_username || 'טרם נמסר'),
        'תחילת ניסיון: ' + new Date(trial.redeemed_at).toLocaleString('he-IL'),
        order.status === 'refunded' ? 'רכישה זוכתה — דורש בדיקה' : '',
        trial.access_removed_at ? 'גישה הוסרה' : 'הגישה ניתנה',
        !trial.notified_at ? 'התראת המייל ממתינה לשליחה' : '',
      ].filter(Boolean).join(' · '),
    }]
  })
}
