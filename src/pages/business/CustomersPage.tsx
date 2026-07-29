import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { getCustomerAlerts, daysUntil } from '../../lib/businessStats'
import { FilterField, filterInputClass } from '../../components/BusinessFormControls'
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

const STATUSES: CustomerStatus[] = ['active', 'paused', 'cancelled']

type AlertFilter = '' | 'has' | 'none'

export function CustomersPage() {
  const { customers, loading, error } = useCustomers()
  const { billings } = useCustomerBillings()

  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('')
  const [planFilter, setPlanFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [mentorFilter, setMentorFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('')

  const planOptions = useMemo(() => Array.from(new Set(customers.map((c) => c.plan).filter(Boolean))).sort(), [customers])
  const periodOptions = useMemo(
    () => Array.from(new Set(customers.map((c) => c.period).filter(Boolean))).sort(),
    [customers],
  )
  const mentorOptions = useMemo(
    () => Array.from(new Set(customers.map((c) => c.mentor).filter(Boolean))).sort(),
    [customers],
  )

  const enriched = useMemo(
    () =>
      customers.map((c) => ({
        customer: c,
        alerts: getCustomerAlerts(c, billings),
        days: daysUntil(c.subscription_end_date),
      })),
    [customers, billings],
  )

  const filtered = useMemo(() => {
    return enriched.filter(({ customer: c, alerts }) => {
      if (nameFilter && !c.full_name.includes(nameFilter)) return false
      if (statusFilter && c.status !== statusFilter) return false
      if (planFilter && c.plan !== planFilter) return false
      if (periodFilter && c.period !== periodFilter) return false
      if (mentorFilter && c.mentor !== mentorFilter) return false
      if (fromDate && c.subscription_end_date < fromDate) return false
      if (toDate && c.subscription_end_date > toDate) return false
      const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
      if (alertFilter === 'has' && !hasAlert) return false
      if (alertFilter === 'none' && hasAlert) return false
      return true
    })
  }, [enriched, nameFilter, statusFilter, planFilter, periodFilter, mentorFilter, fromDate, toDate, alertFilter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">לקוחות ({filtered.length})</h2>
        <Link
          to="/business/customers/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + לקוח חדש
        </Link>
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-4">
        <FilterField label="שם מלא">
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="סטטוס">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="מסלול">
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className={filterInputClass}>
            <option value="">הכל</option>
            {planOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="תקופה">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="מנטור">
          <select
            value={mentorFilter}
            onChange={(e) => setMentorFilter(e.target.value)}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {mentorOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="סיום מנוי מ-">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="סיום מנוי עד">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="התראות">
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value as AlertFilter)}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            <option value="has">רק עם התראה</option>
            <option value="none">רק בלי התראה</option>
          </select>
        </FilterField>
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען לקוחות...</p>
      ) : filtered.length === 0 ? (
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
              {filtered.map(({ customer: c, alerts, days }) => {
                const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
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
