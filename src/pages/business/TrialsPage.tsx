import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LeadsPage } from './LeadsPage'
import {
  useWebsitePurchases,
  websiteRequest,
} from '../../lib/useWebsitePurchases'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
export function TrialsPage() {
  const { orders, trials, error, loading, refresh } = useWebsitePurchases()
  const [actionError, setActionError] = useState(''),
    [busy, setBusy] = useState('')
  async function act(id: string, action: 'grant' | 'remove' | 'retry') {
    setBusy(id)
    setActionError('')
    try {
      await websiteRequest({ id, action })
      await refresh()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">תקופת ניסיון</h2>
      <p>
        מימושי קופון מרכישות באתר ואנשי ניסיון קיימים. יש להעניק או להסיר גישה
        ב־TradingView ולסמן כאן לאחר ביצוע הפעולה.
      </p>
      {(error || actionError) && (
        <p role="alert" className="text-destructive">
          {actionError || error}
        </p>
      )}
      {loading && <p>טוען מימושים…</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {trials
          .filter((t) => t.redeemed_at)
          .map((t) => {
            const o = orders.find((o) => o.id === t.order_id)
            const expired = Date.now() >= new Date(t.expires_at!).getTime()
            return (
              <Card key={t.id} className="space-y-3 p-5">
                <h3 className="font-semibold">
                  <Link
                    to={'/business/courses/' + t.order_id}
                    className="underline"
                  >
                    {o?.full_name}
                  </Link>
                </h3>
                <p dir="ltr">
                  {o?.email} · {o?.phone}
                </p>
                <p dir="ltr">{t.code}</p>
                <p>
                  TradingView:{' '}
                  {t.tradingview_username || 'טרם נמסר — יש לבקש מהלקוח'}
                </p>
                <p>
                  תחילת ניסיון:{' '}
                  {new Date(t.redeemed_at!).toLocaleString('he-IL')} · סיום:{' '}
                  {new Date(t.expires_at!).toLocaleString('he-IL')}
                </p>
                <p>
                  {o?.status === 'refunded'
                    ? 'רכישה זוכתה — דורש בדיקה'
                    : expired
                      ? t.access_removed_at
                        ? 'הניסיון הסתיים · גישה הוסרה'
                        : 'הניסיון הסתיים — יש להסיר גישה'
                      : t.access_granted_at
                        ? 'בתקופת ניסיון · הגישה ניתנה'
                        : 'נדרש לצרף לאינדיקטור'}
                </p>
                {!t.notified_at && (
                  <p className="text-destructive">התראת המייל ממתינה לשליחה</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!expired &&
                    !t.access_granted_at &&
                    o?.status !== 'refunded' && (
                      <Button
                        disabled={busy === t.id}
                        onClick={() => void act(t.id, 'grant')}
                      >
                        סימון שניתנה גישה
                      </Button>
                    )}
                  {t.access_granted_at && !t.access_removed_at && (
                    <Button
                      variant="outline"
                      disabled={busy === t.id}
                      onClick={() => void act(t.id, 'remove')}
                    >
                      סימון שהוסרה גישה
                    </Button>
                  )}
                  {!t.notified_at && (
                    <Button
                      variant="outline"
                      disabled={busy === t.id}
                      onClick={() => void act(t.id, 'retry')}
                    >
                      שליחת ההתראה למייל
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
      </div>
      <LeadsPage trialsOnly />
    </div>
  )
}
