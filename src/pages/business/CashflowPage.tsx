import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { useExpenses } from '../../lib/useExpenses'
import { computeCashflowByMonth } from '../../lib/businessStats'
import { formatCurrency } from '../../lib/format'
import { StatTile } from '../../components/StatTile'

const COLOR_POSITIVE = '#34d399'
const COLOR_NEGATIVE = '#f87171'
const AXIS_COLOR = '#71717a'
const GRID_COLOR = '#27272a'

function tooltipStyle() {
  return {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 8,
    color: '#f4f4f5',
    fontSize: 12,
    direction: 'rtl' as const,
  }
}

export function CashflowPage() {
  const { billings, loading: loadingBillings, error: billingsError } = useCustomerBillings()
  const { expenses, loading: loadingExpenses, error: expensesError } = useExpenses()

  const loading = loadingBillings || loadingExpenses
  const error = billingsError ?? expensesError

  const points = useMemo(() => computeCashflowByMonth(billings, expenses, 12), [billings, expenses])
  const latest = points.length > 0 ? points[points.length - 1] : null

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען נתוני תזרים...</p>
  }

  if (error) {
    return <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">תזרים מזומנים</h2>

      {latest && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={`הכנסות — ${latest.label}`} value={formatCurrency(latest.income)} tone="positive" />
          <StatTile
            label={`עלויות מסלול — ${latest.label}`}
            value={formatCurrency(-latest.planCost)}
            tone="negative"
          />
          <StatTile label={`הוצאות נוספות — ${latest.label}`} value={formatCurrency(-latest.expenses)} tone="negative" />
          <StatTile
            label={`תזרים נטו — ${latest.label}`}
            value={formatCurrency(latest.net)}
            tone={latest.net > 0 ? 'positive' : latest.net < 0 ? 'negative' : 'neutral'}
          />
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">תזרים נטו לפי חודש</h3>
        {points.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">אין נתונים להצגה</p>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} barCategoryGap={8}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
                <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} width={56} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="net" radius={[4, 4, 4, 4]} maxBarSize={28}>
                  {points.map((p) => (
                    <Cell key={p.key} fill={p.net >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">פירוט חודשי</h3>
        {points.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">אין נתונים להצגה</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">חודש</th>
                  <th className="px-3 py-2 text-right font-medium">הכנסות</th>
                  <th className="px-3 py-2 text-right font-medium">עלויות מסלול</th>
                  <th className="px-3 py-2 text-right font-medium">הוצאות נוספות</th>
                  <th className="px-3 py-2 text-right font-medium">תזרים נטו</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {[...points].reverse().map((p) => (
                  <tr key={p.key} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 text-zinc-300">{p.label}</td>
                    <td className="px-3 py-2 text-emerald-400" dir="ltr">
                      {formatCurrency(p.income)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400" dir="ltr">
                      {formatCurrency(-p.planCost)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400" dir="ltr">
                      {formatCurrency(-p.expenses)}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${p.net > 0 ? 'text-emerald-400' : p.net < 0 ? 'text-red-400' : 'text-zinc-400'}`}
                      dir="ltr"
                    >
                      {formatCurrency(p.net)}
                    </td>
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
