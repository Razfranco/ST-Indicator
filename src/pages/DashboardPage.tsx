import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTrades } from '../lib/useTrades'
import {
  computeDashboardTotals,
  computeMonthCalendar,
  computePeriodPnl,
  computePeriodResultCounts,
  computeProfitFactor,
  computeResultCounts,
  computeTradeBreakevenRate,
  computeTradeLossRate,
  computeTradeWinRate,
  currentPeriodBounds,
  filterTradesByRange,
  type DashboardScope,
  type Period,
} from '../lib/stats'
import { formatCurrency, formatPercent, formatProfitFactor } from '../lib/format'
import { StatTile } from '../components/StatTile'

const COLOR_WIN = '#34d399'
const COLOR_LOSS = '#f87171'
const COLOR_BE = '#71717a'
const AXIS_COLOR = '#71717a'
const GRID_COLOR = '#27272a'

const SCOPE_LABELS: Record<DashboardScope, string> = {
  monthly: 'חודשי',
  weekly: 'שבועי',
  daily: 'יומי',
  total: 'סה״כ',
}

/** רזולוציית הפילוח בגרפים, נגזרת מהתקופה הנבחרת */
const CHART_BUCKET: Record<DashboardScope, Period> = {
  daily: 'daily',
  weekly: 'daily',
  monthly: 'weekly',
  total: 'monthly',
}

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

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

export function DashboardPage() {
  const { trades, loading, error } = useTrades()
  const [scope, setScope] = useState<DashboardScope>('monthly')
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const scopedTrades = useMemo(() => {
    const { start, end } = currentPeriodBounds(scope)
    return filterTradesByRange(trades, start, end)
  }, [trades, scope])

  const chartBucket = CHART_BUCKET[scope]
  const chartLimit = scope === 'total' ? 12 : 60

  const totals = useMemo(() => computeDashboardTotals(scopedTrades), [scopedTrades])
  const winRate = useMemo(() => computeTradeWinRate(scopedTrades), [scopedTrades])
  const lossRate = useMemo(() => computeTradeLossRate(scopedTrades), [scopedTrades])
  const breakevenRate = useMemo(() => computeTradeBreakevenRate(scopedTrades), [scopedTrades])
  const resultCounts = useMemo(() => computeResultCounts(scopedTrades), [scopedTrades])
  const profitFactor = useMemo(() => computeProfitFactor(scopedTrades), [scopedTrades])
  const periodPnl = useMemo(
    () => computePeriodPnl(scopedTrades, chartBucket, chartLimit),
    [scopedTrades, chartBucket, chartLimit],
  )
  const periodResults = useMemo(
    () => computePeriodResultCounts(scopedTrades, chartBucket, chartLimit),
    [scopedTrades, chartBucket, chartLimit],
  )
  const calendar = useMemo(
    () => computeMonthCalendar(trades, calYear, calMonth),
    [trades, calYear, calMonth],
  )

  const maxAbsDayPnl = useMemo(
    () => Math.max(1, ...calendar.cells.map((c) => Math.abs(c.pnl))),
    [calendar],
  )

  function goMonth(delta: number) {
    const d = new Date(calYear, calMonth + delta, 1)
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth())
  }

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען נתונים...</p>
  }

  if (error) {
    return <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h2 className="text-xl font-bold">דשבורד</h2>

      <div className="flex gap-1 self-start rounded-lg border border-zinc-700 bg-zinc-800 p-1">
        {(['monthly', 'weekly', 'daily', 'total'] as DashboardScope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              scope === s ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            }`}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="רווח/הפסד כולל"
          value={formatCurrency(totals.totalPnl)}
          tone={totals.totalPnl > 0 ? 'positive' : totals.totalPnl < 0 ? 'negative' : 'neutral'}
        />
        <StatTile
          label="Profit Factor"
          value={formatProfitFactor(profitFactor)}
          tone={profitFactor == null ? 'neutral' : profitFactor >= 1 ? 'positive' : 'negative'}
        />
        <StatTile label="אחוז ימים רווחיים" value={formatPercent(totals.profitableDaysPct)} />
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <span className="text-xs text-zinc-500">מרוויחות מול מפסידות מול ברייק-איבן</span>
          <span className="text-lg font-semibold" dir="ltr">
            <span className="text-emerald-400">{formatPercent(winRate)}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-red-400">{formatPercent(lossRate)}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-zinc-400">{formatPercent(breakevenRate)}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <span className="text-xs text-zinc-500">מספר עסקאות (מרוויחות / מפסידות / BE)</span>
          <span className="text-lg font-semibold" dir="ltr">
            <span className="text-emerald-400">{resultCounts.win}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-red-400">{resultCounts.loss}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-zinc-400">{resultCounts.breakeven}</span>
          </span>
        </div>
        <StatTile label="רווח ממוצע" value={formatCurrency(totals.avgWin)} tone="positive" />
        <StatTile label="הפסד ממוצע" value={formatCurrency(totals.avgLoss)} tone="negative" />
        <StatTile label="מספר עסקאות" value={String(totals.tradeCount)} />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-400">יומן חודשי (החודש הנוכחי)</h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
            >
              ‹ קודם
            </button>
            <span className="min-w-[90px] text-center font-medium text-zinc-200">
              {calendar.monthLabel}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
            >
              הבא ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
          {Array.from({ length: calendar.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {calendar.cells.map((cell) => {
            const hasTrades = cell.tradeCount > 0
            const intensity = hasTrades ? 0.25 + 0.6 * (Math.abs(cell.pnl) / maxAbsDayPnl) : 0
            const bg = !hasTrades
              ? 'transparent'
              : cell.pnl > 0
                ? `rgba(52, 211, 153, ${intensity})`
                : cell.pnl < 0
                  ? `rgba(248, 113, 113, ${intensity})`
                  : 'rgba(113, 113, 122, 0.3)'
            return (
              <div
                key={cell.dateKey}
                className="flex aspect-square flex-col items-center justify-center rounded-md border border-zinc-800/60 text-[11px]"
                style={{ backgroundColor: bg }}
                title={hasTrades ? `${cell.dateKey}: ${formatCurrency(cell.pnl)}` : cell.dateKey}
              >
                <span className="text-zinc-400">{cell.dayOfMonth}</span>
                {hasTrades && (
                  <span
                    className={`font-medium ${cell.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
                    dir="ltr"
                  >
                    {cell.pnl >= 0 ? '+' : ''}
                    {Math.round(cell.pnl)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">רווח/הפסד — {SCOPE_LABELS[scope]}</h3>
        {periodPnl.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">אין נתונים להצגה</p>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodPnl} barCategoryGap={8}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
                <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={24}>
                  {periodPnl.map((p) => (
                    <Cell key={p.key} fill={p.pnl >= 0 ? COLOR_WIN : COLOR_LOSS} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-400">
          עסקאות מרוויחות / מפסידות / ברייק-איבן — {SCOPE_LABELS[scope]}
        </h3>
        {periodResults.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">אין נתונים להצגה</p>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodResults} barCategoryGap={8}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
                <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend
                  formatter={(value) =>
                    value === 'win' ? 'מרוויחות' : value === 'loss' ? 'מפסידות' : 'ברייק-איבן'
                  }
                  wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }}
                />
                <Bar dataKey="win" fill={COLOR_WIN} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="loss" fill={COLOR_LOSS} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="breakeven" fill={COLOR_BE} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
