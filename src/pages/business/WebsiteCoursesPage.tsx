import { formatTrialExpiry } from '../../lib/format'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWebsitePurchases } from '../../lib/useWebsitePurchases'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
export function WebsiteCoursesPage({ coupons = false }: { coupons?: boolean }) {
  const { orders, trials, error, loading, asOf, refresh } =
      useWebsitePurchases(),
    [search, setSearch] = useState('')
  const { id } = useParams()
  const purchases = orders.filter((o) => o.course)
  const people = [
    ...new Set(purchases.map((o) => o.email.trim().toLowerCase())),
  ]
  const selected = purchases.find((o) => o.id === id)
  const display = selected
    ? purchases.filter(
        (o) =>
          o.email.trim().toLowerCase() === selected.email.trim().toLowerCase(),
      )
    : purchases.filter((o) =>
        [
          o.full_name,
          o.email,
          o.phone,
          trials.find((t) => t.order_id === o.id)?.code ?? '',
        ].some((v) => v.toLowerCase().includes(search.toLowerCase())),
      )
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {selected
          ? 'פרופיל רוכש קורס: ' + selected.full_name
          : coupons
            ? 'קופוני ניסיון אינדיקטור'
            : 'מנויי קורס'}{' '}
        {!selected && `(${people.length})`}
      </h2>
      <p className="text-sm text-muted-foreground">
        רכישות שאומתו באתר מסונכרנות אוטומטית. הקופון אישי וחד־פעמי; 30 ימי
        הניסיון מתחילים במימוש.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {loading && <p>טוען…</p>}
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="חיפוש רוכש או קופון"
          placeholder="חיפוש לפי שם, מייל, נייד או קופון"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 flex-1 rounded-md border border-border p-2"
        />
        <Button variant="outline" onClick={() => void refresh()}>
          רענון
        </Button>
      </div>
      {asOf && (
        <p className="text-xs text-muted-foreground">
          עודכן: {new Date(asOf).toLocaleString('he-IL')}
        </p>
      )}
      {selected && (
        <Link to="/business/courses" className="underline">
          חזרה למנויי הקורס
        </Link>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {display.map((o) => {
          const t = trials.find((t) => t.order_id === o.id)
          return (
            <Card key={o.id} className="p-5 space-y-3">
              <h3 className="font-semibold">
                <Link to={'/business/courses/' + o.id} className="underline">
                  {o.full_name}
                </Link>
              </h3>
              <p dir="ltr">
                {o.email} · {o.phone}
              </p>
              <p>
                הזמנה #{o.order_number} · {o.product_name}
              </p>
              <p>
                תשלום:{' '}
                {o.amount.toLocaleString('he-IL', {
                  style: 'currency',
                  currency: 'ILS',
                })}{' '}
                · {o.installments_chosen ?? 1} תשלומים ·{' '}
                {o.status === 'refunded' ? 'זוכה' : 'שולם'}
              </p>
              <p>
                מועד רכישה:{' '}
                {new Date(o.paid_at ?? o.created_at).toLocaleString('he-IL')}
              </p>
              <p>
                מחיר לפני הנחה: {o.list_price} ₪ · קוד הנחה ברכישה:{' '}
                {o.coupon_code ?? 'ללא'}
              </p>
              {(o.street || o.city) && (
                <p>כתובת: {[o.street, o.city].filter(Boolean).join(', ')}</p>
              )}
              <p>
                TradingView:{' '}
                {t?.tradingview_username ??
                  o.tradingview_username ??
                  'טרם נמסר'}
              </p>
              {t ? (
                <>
                  <p>
                    קופון אישי: <strong dir="ltr">{t.code}</strong>
                  </p>
                  <p>
                    {t.redeemed_at
                      ? `מומש ב־${new Date(t.redeemed_at).toLocaleString('he-IL')} · סיום: ${formatTrialExpiry(t.expires_at)}`
                      : 'טרם מומש · תקופת הניסיון טרם התחילה'}
                  </p>
                  {t.archived_at && <p>הוסר מרשימת תקופות הניסיון. פרטי הרכישה והמימוש נשמרו.</p>}
                  <a
                    className="inline-flex min-h-11 items-center underline"
                    href="https://sharktradebom.com/indicator/trial"
                    target="_blank"
                    rel="noreferrer"
                  >
                    קישור למימוש הניסיון
                  </a>
                </>
              ) : (
                <p>לרכישה זו אין קופון ניסיון.</p>
              )}
            </Card>
          )
        })}
      </div>
      {!loading && !error && display.length === 0 && <p>אין רכישות להצגה.</p>}
    </div>
  )
}
