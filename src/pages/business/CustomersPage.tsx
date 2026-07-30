import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { getCustomerAlerts, getEffectiveStatus, daysUntil } from '../../lib/businessStats'
import { FilterField, filterInputClass, SortHeader, CardField } from '../../components/BusinessFormControls'
import type { SortDir } from '../../components/BusinessFormControls'
import { StatTile } from '../../components/StatTile'
import type { Customer, CustomerEffectiveStatus } from '../../types/business.types'

const statusClass: Record<CustomerEffectiveStatus, string> = {
  active: 'bg-emerald-950 text-emerald-400',
  paused: 'bg-amber-950 text-amber-400',
  cancelled: 'bg-red-950 text-red-400',
  expired: 'bg-rose-950 text-rose-400',
}

const statusLabel: Record<CustomerEffectiveStatus, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  cancelled: 'מבוטל',
  expired: 'מנוי פג',
}

const STATUSES: CustomerEffectiveStatus[] = ['active', 'expired', 'paused', 'cancelled']

type AlertFilter = '' | 'has' | 'none'

type SortField = 'full_name' | 'status' | 'plan' | 'period' | 'subscription_end_date' | 'mentor'

/** צבע שם המסלול לפי סוג המסלול (טקסט חופשי, הכלה case-insensitive בעברית/אנגלית) */
function planColorClass(plan: string): string {
  const p = plan.toLowerCase()
  if (p.includes('גולד') || p.includes('gold')) return 'text-amber-400'
  if (p.includes('סילבר') || p.includes('silver')) return 'text-gray-300'
  if (p.includes('פלטינום') || p.includes('platinum')) return 'text-cyan-400'
  return 'text-zinc-300'
}

export function CustomersPage() {
  const { customers, loading, error } = useCustomers()
  const { billings } = useCustomerBillings()

  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerEffectiveStatus | ''>('')
  const [planFilter, setPlanFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [mentorFilter, setMentorFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('')

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const activeCount = useMemo(
    () => customers.filter((c) => getEffectiveStatus(c) === 'active').length,
    [customers],
  )
  const expiredCount = useMemo(
    () => customers.filter((c) => getEffectiveStatus(c) === 'expired').length,
    [customers],
  )

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
        effectiveStatus: getEffectiveStatus(c),
      })),
    [customers, billings],
  )

  const filtered = useMemo(() => {
    return enriched.filter(({ customer: c, alerts, effectiveStatus }) => {
      if (nameFilter && !c.full_name.includes(nameFilter)) return false
      if (statusFilter && effectiveStatus !== statusFilter) return false
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

  const sorted = useMemo(() => {
    if (!sortField) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'full_name':
          cmp = a.customer.full_name.localeCompare(b.customer.full_name, 'he')
          break
        case 'status':
          cmp = statusLabel[a.effectiveStatus].localeCompare(statusLabel[b.effectiveStatus], 'he')
          break
        case 'plan':
          cmp = a.customer.plan.localeCompare(b.customer.plan, 'he')
          break
        case 'period':
          cmp = a.customer.period.localeCompare(b.customer.period, 'he')
          break
        case 'subscription_end_date':
          cmp = a.customer.subscription_end_date.localeCompare(b.customer.subscription_end_date)
          break
        case 'mentor':
          cmp = a.customer.mentor.localeCompare(b.customer.mentor, 'he')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">לקוחות</h2>
        <Link
          to="/business/customers/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + לקוח חדש
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="משתמשים פעילים" value={String(activeCount)} tone="positive" />
        <StatTile label="מנוי פג" value={String(expiredCount)} tone={expiredCount > 0 ? 'negative' : 'neutral'} />
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
            onChange={(e) => setStatusFilter(e.target.value as CustomerEffectiveStatus | '')}
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
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין לקוחות להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map(({ customer: c, alerts, days, effectiveStatus }) => (
              <CustomerCard key={c.id} customer={c} alerts={alerts} days={days} effectiveStatus={effectiveStatus} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <SortHeader label="שם מלא" field="full_name" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">טלפון</th>
                  <SortHeader label="מסלול" field="plan" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="תקופה" field="period" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader
                    label="סיום מנוי"
                    field="subscription_end_date"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader
                    label="ימים לסיום"
                    field="subscription_end_date"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader label="מנטור" field="mentor" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">התראות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.map(({ customer: c, alerts, days, effectiveStatus }) => {
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
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[effectiveStatus]}`}>
                          {statusLabel[effectiveStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-300" dir="ltr">
                        {c.phone}
                      </td>
                      <td className={`px-3 py-2 font-medium ${planColorClass(c.plan)}`}>{c.plan}</td>
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
        </>
      )}
    </div>
  )
}

function CustomerCard({
  customer: c,
  alerts,
  days,
  effectiveStatus,
}: {
  customer: Customer
  alerts: { expiringSoon: boolean; billingDueSoon: boolean }
  days: number
  effectiveStatus: CustomerEffectiveStatus
}) {
  const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
  return (
    <Link
      to={`/business/customers/${c.id}/edit`}
      className={`flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 ${
        hasAlert ? 'border-r-2 border-orange-500 bg-orange-950/20' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">{c.full_name}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[effectiveStatus]}`}>
          {statusLabel[effectiveStatus]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <CardField label="טלפון">
          <span dir="ltr">{c.phone}</span>
        </CardField>
        <CardField label="מסלול">
          <span className={planColorClass(c.plan)}>{c.plan}</span>
        </CardField>
        <CardField label="תקופה">{c.period}</CardField>
        <CardField label="מנטור">{c.mentor}</CardField>
        <CardField label="סיום מנוי">
          <span dir="ltr">{c.subscription_end_date}</span>
        </CardField>
        <CardField label="ימים לסיום">
          <span dir="ltr" className={days <= 7 ? 'text-orange-400' : ''}>
            {days}
          </span>
        </CardField>
      </div>

      {hasAlert && (
        <div className="flex flex-wrap gap-1 border-t border-zinc-800 pt-2">
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
      )}
    </Link>
  )
}
