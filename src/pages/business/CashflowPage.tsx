import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/useCustomers'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { useExpenses } from '../../lib/useExpenses'
import { computeYearCashflow, monthKeyOf } from '../../lib/businessStats'
import { formatCurrency } from '../../lib/format'
import { StatTile } from '../../components/StatTile'

const now = new Date()

export function CashflowPage() {
  const { customers } = useCustomers()
  const { billings, loading: loadingBillings, error: billingsError } = useCustomerBillings()
  const { expenses, loading: loadingExpenses, error: expensesError } = useExpenses()

  const [year, setYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())

  const loading = loadingBillings || loadingExpenses
  const error = billingsError ?? expensesError

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.full_name)
    return map
  }, [customers])

  const months = useMemo(() => computeYearCashflow(billings, expenses, year), [billings, expenses, year])
  const selected = months[selectedMonth]

  const selectedMonthKey = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`
  const selectedBillings = useMemo(
    () => billings.filter((b) => monthKeyOf(b.billing_month) === selectedMonthKey),
    [billings, selectedMonthKey],
  )
  const selectedExpenses = useMemo(
    () => expenses.filter((e) => monthKeyOf(e.expense_month) === selectedMonthKey),
    [expenses, selectedMonthKey],
  )

  const maxAbsNet = useMemo(() => Math.max(1, ...months.map((m) => Math.abs(m.net))), [months])

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען נתוני תזרים...</p>
  }

  if (error) {
    return <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">תזרים מזומנים</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={`הכנסות — ${selected.label} ${year}`} value={formatCurrency(selected.income)} tone="positive" />
        <StatTile
          label={`עלויות מסלול — ${selected.label} ${year}`}
          value={formatCurrency(-selected.planCost)}
          tone="negative"
        />
        <StatTile
          label={`הוצאות נוספות — ${selected.label} ${year}`}
          value={formatCurrency(-selected.expenses)}
          tone="negative"
        />
        <StatTile
          label={`תזרים נטו — ${selected.label} ${year}`}
          value={formatCurrency(selected.net)}
          tone={selected.net > 0 ? 'positive' : selected.net < 0 ? 'negative' : 'neutral'}
        />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-400">תזרים לפי חודש</h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
            >
              ‹ קודמת
            </button>
            <span className="min-w-[60px] text-center font-medium text-zinc-200" dir="ltr">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
            >
              הבאה ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {months.map((m) => {
            const intensity = m.hasData ? 0.25 + 0.6 * (Math.abs(m.net) / maxAbsNet) : 0
            const bg = !m.hasData
              ? 'transparent'
              : m.net > 0
                ? `rgba(52, 211, 153, ${intensity})`
                : m.net < 0
                  ? `rgba(248, 113, 113, ${intensity})`
                  : 'rgba(113, 113, 122, 0.3)'
            const isSelected = m.monthIndex === selectedMonth
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonth(m.monthIndex)}
                className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border text-sm transition ${
                  isSelected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-zinc-800/60'
                }`}
                style={{ backgroundColor: bg }}
              >
                <span className="text-zinc-300">{m.label}</span>
                <span
                  className={`font-semibold ${
                    !m.hasData ? 'text-zinc-600' : m.net >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                  dir="ltr"
                >
                  {m.hasData ? formatCurrency(m.net) : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">
          פירוט — {selected.label} {year}
        </h3>

        <h4 className="mb-2 text-xs font-semibold text-zinc-500">חיובים</h4>
        {selectedBillings.length === 0 ? (
          <p className="py-3 text-center text-sm text-zinc-500">אין חיובים בחודש זה.</p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">לקוח</th>
                  <th className="px-3 py-2 text-right font-medium">סכום</th>
                  <th className="px-3 py-2 text-right font-medium">עלות מסלול</th>
                  <th className="px-3 py-2 text-right font-medium">רווח</th>
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {selectedBillings.map((b) => {
                  const profit = b.amount - b.plan_cost
                  return (
                    <tr key={b.id} className="hover:bg-zinc-900/60">
                      <td className="px-3 py-2">
                        <Link
                          to={`/business/customers/${b.customer_id}/edit`}
                          className="font-medium text-zinc-200 hover:text-emerald-400"
                        >
                          {customerNameById.get(b.customer_id) ?? 'לקוח לא ידוע'}
                        </Link>
                        {b.is_recurring_monthly && (
                          <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                            חודשי
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-200" dir="ltr">
                        {formatCurrency(b.amount)}
                      </td>
                      <td className="px-3 py-2 text-zinc-400" dir="ltr">
                        {formatCurrency(-b.plan_cost)}
                      </td>
                      <td
                        className={`px-3 py-2 font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                        dir="ltr"
                      >
                        {formatCurrency(profit)}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{b.billing_note ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-800 bg-zinc-900/60 font-medium">
                  <td className="px-3 py-2 text-zinc-300">סה״כ</td>
                  <td className="px-3 py-2 text-emerald-400" dir="ltr">
                    {formatCurrency(selected.income)}
                  </td>
                  <td className="px-3 py-2 text-zinc-400" dir="ltr">
                    {formatCurrency(-selected.planCost)}
                  </td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {formatCurrency(selected.income - selected.planCost)}
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <h4 className="mb-2 text-xs font-semibold text-zinc-500">הוצאות נוספות</h4>
        {selectedExpenses.length === 0 ? (
          <p className="py-3 text-center text-sm text-zinc-500">אין הוצאות בחודש זה.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">הוצאה</th>
                  <th className="px-3 py-2 text-right font-medium">סכום</th>
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {selectedExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 font-medium text-zinc-200">{e.expense_name}</td>
                    <td className="px-3 py-2 text-red-400" dir="ltr">
                      {formatCurrency(-e.amount)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
