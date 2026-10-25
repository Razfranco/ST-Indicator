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
  computeTradeSuccessRate,
  currentPeriodBounds,
  filterTradesByRange,
  type DashboardScope,
  type Period,
} from '../lib/stats'
import { formatCurrency, formatPercent, formatProfitFactor } from '../lib/format'
import { StatTile } from '../components/StatTile'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'

const COLOR_WIN = '#1b7a43'
const COLOR_LOSS = '#b3261e'
const COLOR_BE = '#8a8275'
const AXIS_COLOR = '#a39a8a'
const GRID_COLOR = '#e4ddce'

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
    backgroundColor: '#ffffff',
    border: '1px solid #e4ddce',
    borderRadius: 8,
    color: '#1c1b19',
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
    if (scope === 'monthly') {
      // בסקופ חודשי, הנתונים למעלה תמיד תואמים לחודש שמוצג ביומן (calYear/calMonth),
      // לא בהכרח לחודש הקלנדרי הנוכחי — כדי שניווט ביומן יעדכן גם את הסטטיסטיקות.
      const start = new Date(calYear, calMonth, 1)
      const end = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999)
      return filterTradesByRange(trades, start, end)
    }
    const { start, end } = currentPeriodBounds(scope)
    return filterTradesByRange(trades, start, end)
  }, [trades, scope, calYear, calMonth])

  const chartBucket = CHART_BUCKET[scope]
  const chartLimit = scope === 'total' ? 12 : 60

  const totals = useMemo(() => computeDashboardTotals(scopedTrades), [scopedTrades])
  const successRate = useMemo(() => computeTradeSuccessRate(scopedTrades), [scopedTrades])
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
    return (
      <div className="flex flex-col gap-5 pb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-destructive">{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h2 className="font-heading text-xl font-semibold">
        דשבורד
        {scope === 'monthly' && (
          <span className="mr-2 text-sm font-normal text-muted-foreground">— {calendar.monthLabel}</span>
        )}
      </h2>

      <div className="flex gap-1 self-start rounded-lg border border-border bg-muted p-1">
        {(['monthly', 'weekly', 'daily', 'total'] as DashboardScope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              scope === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
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
        <StatTile
          label="אחוז רווח/הפסד"
          value={formatPercent(successRate)}
          tone={successRate == null ? 'neutral' : successRate >= 50 ? 'positive' : 'negative'}
        />
        <Card size="sm" className="gap-1 shadow-sm">
          <div className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">מספר עסקאות (מרוויחות / מפסידות / BE)</span>
            <span className="text-lg font-semibold" dir="ltr">
              <span className="text-primary">{resultCounts.win}</span>
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-destructive">{resultCounts.loss}</span>
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-muted-foreground">{resultCounts.breakeven}</span>
            </span>
          </div>
        </Card>
        <StatTile label="רווח ממוצע" value={formatCurrency(totals.avgWin)} tone="positive" />
        <StatTile label="הפסד ממוצע" value={formatCurrency(totals.avgLoss)} tone="negative" />
        <StatTile label="מספר עסקאות" value={String(totals.tradeCount)} />
      </div>

      <Card className="p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-muted-foreground">יומן חודשי</h3>
          <div className="flex items-center gap-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => goMonth(-1)}>
              ‹ קודם
            </Button>
            <span className="min-w-[90px] text-center font-medium text-foreground">{calendar.monthLabel}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => goMonth(1)}>
              הבא ›
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
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
            const intensity = hasTrades ? 0.18 + 0.45 * (Math.abs(cell.pnl) / maxAbsDayPnl) : 0
            const bg = !hasTrades
              ? 'transparent'
              : cell.pnl > 0
                ? `rgba(27, 122, 67, ${intensity})`
                : cell.pnl < 0
                  ? `rgba(179, 38, 30, ${intensity})`
                  : 'rgba(138, 130, 117, 0.25)'
            return (
              <div
                key={cell.dateKey}
                className="flex aspect-square flex-col items-center justify-center rounded-md border border-border/60 text-[11px]"
                style={{ backgroundColor: bg }}
                title={hasTrades ? `${cell.dateKey}: ${formatCurrency(cell.pnl)}` : cell.dateKey}
              >
                <span className="text-muted-foreground">{cell.dayOfMonth}</span>
                {hasTrades && (
                  <span
                    className={`font-medium ${cell.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}
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
      </Card>

      <Card className="p-4 shadow-sm">
        <h3 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
          רווח/הפסד — {SCOPE_LABELS[scope]}
        </h3>
        {periodPnl.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין נתונים להצגה</p>
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
      </Card>

      <Card className="p-4 shadow-sm">
        <h3 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
          עסקאות מרוויחות / מפסידות / ברייק-איבן — {SCOPE_LABELS[scope]}
        </h3>
        {periodResults.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין נתונים להצגה</p>
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
                  wrapperStyle={{ fontSize: 12, color: '#6b6459' }}
                />
                <Bar dataKey="win" fill={COLOR_WIN} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="loss" fill={COLOR_LOSS} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="breakeven" fill={COLOR_BE} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}
