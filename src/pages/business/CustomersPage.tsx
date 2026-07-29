import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { getCustomerAlerts, daysUntil } from '../../lib/businessStats'
import type { CustomerStatus } from '../../types/business.types'

const statusClass: Record<CustomerStatus, string> = {
  active: 'bg-emerald-950 text-emerald-400',
  paused: 'bg-amber-950 text-amber-400',
  cancelled: 'bg-red-950 text-red-400',
}

const statusLabel: Record<CustomerStatus, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  cancelled: 'מבוטל',
}

export function CustomersPage() {
  const { customers, loading, error } = useCustomers()
  const { billings } = useCustomerBillings()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">לקוחות ({customers.length})</h2>
        <Link
          to="/business/customers/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + לקוח חדש
        </Link>
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען לקוחות...</p>
      ) : customers.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין לקוחות להצגה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">שם מלא</th>
                <th className="px-3 py-2 text-right font-medium">סטטוס</th>
                <th className="px-3 py-2 text-right font-medium">טלפון</th>
                <th className="px-3 py-2 text-right font-medium">מסלול</th>
                <th className="px-3 py-2 text-right font-medium">תקופה</th>
                <th className="px-3 py-2 text-right font-medium">סיום מנוי</th>
                <th className="px-3 py-2 text-right font-medium">ימים לסיום</th>
                <th className="px-3 py-2 text-right font-medium">מנטור</th>
                <th className="px-3 py-2 text-right font-medium">התראות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {customers.map((c) => {
                const alerts = getCustomerAlerts(c, billings)
                const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
                const days = daysUntil(c.subscription_end_date)
                return (
                  <tr
                    key={c.id}
                    className={`cursor-pointer hover:bg-zinc-900/60 ${
                      hasAlert ? 'border-r-2 border-orange-500 bg-orange-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Link to={`/business/customers/${c.id}/edit`} className="font-medium text-zinc-200">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[c.status]}`}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {c.phone}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{c.plan}</td>
                    <td className="px-3 py-2 text-zinc-300">{c.period}</td>
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {c.subscription_end_date}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        days <= 7 ? 'text-orange-400' : 'text-zinc-300'
                      }`}
                      dir="ltr"
                    >
                      {days}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{c.mentor}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {alerts.expiringSoon && (
                          <span className="rounded bg-orange-950 px-1.5 py-0.5 text-xs font-semibold text-orange-400">
                            מנוי מסתיים
                          </span>
                        )}
                        {alerts.billingDueSoon && (
                          <span className="rounded bg-amber-950 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                            חיוב קרוב
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
