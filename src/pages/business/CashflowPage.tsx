import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { useExpenses } from '../../lib/useExpenses'
import { useFixedExpenses } from '../../lib/useFixedExpenses'
import { computeYearCashflow, countFixedExpenseOccurrences, monthKeyOf } from '../../lib/businessStats'
import { formatILS } from '../../lib/format'
import { StatTile } from '../../components/StatTile'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../../components/ui/table'

const now = new Date()

export function CashflowPage() {
  const { customers } = useCustomers()
  const { billings, loading: loadingBillings, error: billingsError } = useCustomerBillings()
  const { expenses, loading: loadingExpenses, error: expensesError } = useExpenses()
  const { fixedExpenses, loading: loadingFixed, error: fixedError } = useFixedExpenses()

  const [year, setYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())

  const loading = loadingBillings || loadingExpenses || loadingFixed
  const error = billingsError ?? expensesError ?? fixedError

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.full_name)
    return map
  }, [customers])

  const months = useMemo(
    () => computeYearCashflow(billings, expenses, fixedExpenses, year),
    [billings, expenses, fixedExpenses, year],
  )
  const selected = months[selectedMonth]

  const selectedMonthKey = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`
  const selectedMonthStart = useMemo(() => new Date(year, selectedMonth, 1), [year, selectedMonth])
  const selectedMonthEnd = useMemo(
    () => new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999),
    [year, selectedMonth],
  )
  const selectedBillings = useMemo(
    () => billings.filter((b) => monthKeyOf(b.billing_month) === selectedMonthKey),
    [billings, selectedMonthKey],
  )
  const selectedExpenses = useMemo(
    () => expenses.filter((e) => monthKeyOf(e.expense_month) === selectedMonthKey),
    [expenses, selectedMonthKey],
  )
  const selectedFixedExpenses = useMemo(
    () =>
      fixedExpenses
        .map((fe) => ({
          expense: fe,
          occurrences: countFixedExpenseOccurrences(fe.start_date, fe.recurrence, selectedMonthStart, selectedMonthEnd),
        }))
        .filter((row) => row.occurrences > 0),
    [fixedExpenses, selectedMonthStart, selectedMonthEnd],
  )

  const maxAbsNet = useMemo(() => Math.max(1, ...months.map((m) => Math.abs(m.net))), [months])

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">טוען נתוני תזרים...</p>
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-destructive">{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-semibold">תזרים מזומנים</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={`הכנסות — ${selected.label} ${year}`} value={formatILS(selected.income)} tone="positive" />
        <StatTile
          label={`עלויות מסלול — ${selected.label} ${year}`}
          value={formatILS(-selected.planCost)}
          tone="negative"
        />
        <StatTile
          label={`הוצאות (קבועות + משתנות) — ${selected.label} ${year}`}
          value={formatILS(-selected.expenses)}
          tone="negative"
        />
        <StatTile
          label={`תזרים נטו — ${selected.label} ${year}`}
          value={formatILS(selected.net)}
          tone={selected.net > 0 ? 'positive' : selected.net < 0 ? 'negative' : 'neutral'}
        />
      </div>

      <Card className="p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-muted-foreground">תזרים לפי חודש</h3>
          <div className="flex items-center gap-2 text-sm">
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
              ‹ קודמת
            </Button>
            <span className="min-w-[60px] text-center font-medium text-foreground" dir="ltr">
              {year}
            </span>
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
              הבאה ›
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {months.map((m) => {
            const intensity = m.hasData ? 0.12 + 0.3 * (Math.abs(m.net) / maxAbsNet) : 0
            const bg = !m.hasData
              ? 'transparent'
              : m.net > 0
                ? `rgba(15, 81, 50, ${intensity})`
                : m.net < 0
                  ? `rgba(166, 52, 42, ${intensity})`
                  : 'rgba(107, 100, 89, 0.15)'
            const isSelected = m.monthIndex === selectedMonth
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonth(m.monthIndex)}
                className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border text-sm transition ${
                  isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
                style={{ backgroundColor: bg }}
              >
                <span className="text-foreground">{m.label}</span>
                <span
                  className={`font-semibold ${
                    !m.hasData ? 'text-muted-foreground' : m.net >= 0 ? 'text-primary' : 'text-destructive'
                  }`}
                  dir="ltr"
                >
                  {m.hasData ? formatILS(m.net) : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-4 shadow-sm">
        <h3 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
          פירוט — {selected.label} {year}
        </h3>

        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">חיובים</h4>
        {selectedBillings.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">אין חיובים בחודש זה.</p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[560px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>עלות מסלול</TableHead>
                  <TableHead>רווח</TableHead>
                  <TableHead>הערה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBillings.map((b) => {
                  const profit = b.amount - b.plan_cost
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link
                          to={`/business/customers/${b.customer_id}/edit`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {customerNameById.get(b.customer_id) ?? 'לקוח לא ידוע'}
                        </Link>
                        {b.is_recurring_monthly && (
                          <Badge variant="outline" className="me-2 border-transparent bg-muted text-muted-foreground">
                            חודשי
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground" dir="ltr">
                        {formatILS(b.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">
                        {formatILS(-b.plan_cost)}
                      </TableCell>
                      <TableCell
                        className={`font-medium ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}
                        dir="ltr"
                      >
                        {formatILS(profit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.billing_note ?? '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-foreground">סה״כ</TableCell>
                  <TableCell className="text-primary" dir="ltr">
                    {formatILS(selected.income)}
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {formatILS(-selected.planCost)}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {formatILS(selected.income - selected.planCost)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">הוצאות קבועות</h4>
        {selectedFixedExpenses.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">אין הוצאות קבועות בחודש זה.</p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[420px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>הוצאה</TableHead>
                  <TableHead>מופעים</TableHead>
                  <TableHead>סה״כ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedFixedExpenses.map(({ expense, occurrences }) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium text-foreground">{expense.expense_name}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {occurrences}
                    </TableCell>
                    <TableCell className="text-destructive" dir="ltr">
                      {formatILS(-occurrences * expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">הוצאות משתנות</h4>
        {selectedExpenses.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">אין הוצאות משתנות בחודש זה.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[420px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>הוצאה</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>הערה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-foreground">{e.expense_name}</TableCell>
                    <TableCell className="text-destructive" dir="ltr">
                      {formatILS(-e.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
