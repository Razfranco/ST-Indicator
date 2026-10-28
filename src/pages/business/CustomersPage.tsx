import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { getCustomerAlerts, getEffectiveStatus, daysUntil, needsAccessRemoval } from '../../lib/businessStats'
import { FilterField, filterInputClass, SortHeader, CardField } from '../../components/BusinessFormControls'
import type { SortDir } from '../../components/BusinessFormControls'
import { StatTile } from '../../components/StatTile'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { EmptyState } from '../../components/EmptyState'
import type { Customer, CustomerEffectiveStatus } from '../../types/business.types'

const statusClass: Record<CustomerEffectiveStatus, string> = {
  active: 'bg-primary/10 text-primary',
  paused: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-destructive/10 text-destructive',
  expired: 'bg-rose-100 text-rose-800',
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
  if (p.includes('גולד') || p.includes('gold')) return 'text-amber-700'
  if (p.includes('סילבר') || p.includes('silver')) return 'text-stone-600'
  if (p.includes('פלטינום') || p.includes('platinum')) return 'text-sky-700'
  return 'text-foreground'
}

export function CustomersPage() {
  const { customers, loading, error } = useCustomers()
  const { billings } = useCustomerBillings()
  const [searchParams, setSearchParams] = useSearchParams()

  const [nameFilter, setNameFilter] = useState(searchParams.get('name') ?? '')
  const [statusFilter, setStatusFilter] = useState<CustomerEffectiveStatus | ''>(
    (searchParams.get('status') as CustomerEffectiveStatus | '') ?? '',
  )
  const [planFilter, setPlanFilter] = useState(searchParams.get('plan') ?? '')
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') ?? '')
  const [mentorFilter, setMentorFilter] = useState(searchParams.get('mentor') ?? '')
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>((searchParams.get('alert') as AlertFilter) ?? '')

  const [sortField, setSortField] = useState<SortField | null>((searchParams.get('sort') as SortField) ?? null)
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get('dir') as SortDir) ?? 'asc')

  useEffect(() => {
    const next = new URLSearchParams()
    if (nameFilter) next.set('name', nameFilter)
    if (statusFilter) next.set('status', statusFilter)
    if (planFilter) next.set('plan', planFilter)
    if (periodFilter) next.set('period', periodFilter)
    if (mentorFilter) next.set('mentor', mentorFilter)
    if (fromDate) next.set('from', fromDate)
    if (toDate) next.set('to', toDate)
    if (alertFilter) next.set('alert', alertFilter)
    if (sortField) next.set('sort', sortField)
    if (sortField) next.set('dir', sortDir)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter, statusFilter, planFilter, periodFilter, mentorFilter, fromDate, toDate, alertFilter, sortField, sortDir])

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
        needsRemoval: needsAccessRemoval(c),
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
        <h2 className="font-heading text-xl font-semibold">לקוחות</h2>
        <Button render={<Link to="/business/customers/new" />}>+ לקוח חדש</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="משתמשים פעילים" value={String(activeCount)} tone="positive" />
        <StatTile label="מנוי פג" value={String(expiredCount)} tone={expiredCount > 0 ? 'negative' : 'neutral'} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-2 gap-3 p-3 shadow-sm sm:grid-cols-4">
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
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Users}
          title="אין לקוחות להצגה"
          description="נסה/י לשנות את הסינון, או הוסף/י לקוח ראשון."
          action={<Button render={<Link to="/business/customers/new" />}>+ לקוח ראשון</Button>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map(({ customer: c, alerts, days, effectiveStatus, needsRemoval }) => (
              <CustomerCard
                key={c.id}
                customer={c}
                alerts={alerts}
                days={days}
                effectiveStatus={effectiveStatus}
                needsRemoval={needsRemoval}
              />
            ))}
          </div>

          <Card className="hidden overflow-x-auto p-0 shadow-sm sm:block">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <SortHeader label="שם מלא" field="full_name" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <TableHead>טלפון</TableHead>
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
                  <TableHead>התראות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(({ customer: c, alerts, days, effectiveStatus, needsRemoval }) => {
                  const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
                  return (
                    <TableRow
                      key={c.id}
                      className={
                        needsRemoval
                          ? 'border-e-2 border-e-destructive bg-destructive/5'
                          : hasAlert
                            ? 'border-e-2 border-e-orange-400 bg-orange-50'
                            : ''
                      }
                    >
                      <TableCell>
                        <Link to={`/business/customers/${c.id}/edit`} className="font-medium text-foreground">
                          {c.full_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${statusClass[effectiveStatus]}`}>
                          {statusLabel[effectiveStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">
                        {c.phone}
                      </TableCell>
                      <TableCell className={`font-medium ${planColorClass(c.plan)}`}>{c.plan}</TableCell>
                      <TableCell className="text-muted-foreground">{c.period}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">
                        {c.subscription_end_date}
                      </TableCell>
                      <TableCell
                        className={`font-medium ${days <= 7 ? 'text-orange-600' : 'text-muted-foreground'}`}
                        dir="ltr"
                      >
                        {days}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.mentor}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {needsRemoval && (
                            <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                              להסרת גישה
                            </Badge>
                          )}
                          {alerts.expiringSoon && (
                            <Badge variant="outline" className="border-transparent bg-orange-100 text-orange-800">
                              מנוי מסתיים
                            </Badge>
                          )}
                          {alerts.billingDueSoon && (
                            <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                              חיוב קרוב
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
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
  needsRemoval,
}: {
  customer: Customer
  alerts: { expiringSoon: boolean; billingDueSoon: boolean }
  days: number
  effectiveStatus: CustomerEffectiveStatus
  needsRemoval: boolean
}) {
  const hasAlert = alerts.expiringSoon || alerts.billingDueSoon
  return (
    <Card
      className={`gap-2 p-3 shadow-sm ${
        needsRemoval ? 'border-e-2 border-e-destructive bg-destructive/5' : hasAlert ? 'border-e-2 border-e-orange-400 bg-orange-50' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4">
        <Link to={`/business/customers/${c.id}/edit`} className="font-medium text-foreground">
          {c.full_name}
        </Link>
        <Badge variant="outline" className={`border-transparent ${statusClass[effectiveStatus]}`}>
          {statusLabel[effectiveStatus]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 text-xs">
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
          <span dir="ltr" className={days <= 7 ? 'text-orange-600' : ''}>
            {days}
          </span>
        </CardField>
      </div>

      {(needsRemoval || hasAlert) && (
        <div className="flex flex-wrap gap-1 border-t border-border px-4 pt-2">
          {needsRemoval && (
            <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
              להסרת גישה
            </Badge>
          )}
          {alerts.expiringSoon && (
            <Badge variant="outline" className="border-transparent bg-orange-100 text-orange-800">
              מנוי מסתיים
            </Badge>
          )}
          {alerts.billingDueSoon && (
            <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
              חיוב קרוב
            </Badge>
          )}
        </div>
      )}
    </Card>
  )
}
