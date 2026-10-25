import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTrades } from '../lib/useTrades'
import {
  computeDashboardTotals,
  computeProfitFactor,
  computeResultCounts,
  computeTradeSuccessRate,
  weekRange,
} from '../lib/stats'
import { formatCurrency, formatPercent, formatProfitFactor } from '../lib/format'
import type { TradeResult } from '../types/database.types'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { toast } from '../components/ui/toast'
import { EmptyState } from '../components/EmptyState'
import { CalendarX } from 'lucide-react'

const resultClass: Record<TradeResult, string> = {
  TP1: 'bg-primary/10 text-primary',
  TP2: 'bg-primary/10 text-primary',
  SL: 'bg-destructive/10 text-destructive',
  BE: 'bg-muted text-muted-foreground',
}

type ReportPeriod = 'weekly' | 'monthly'

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  weekly: 'שבועי',
  monthly: 'חודשי',
}

function formatDateHe(d: Date): string {
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ReportPage() {
  const { trades, loading, error } = useTrades()
  const [searchParams, setSearchParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const printableRef = useRef<HTMLDivElement>(null)

  const periodMode = (searchParams.get('period') as ReportPeriod | null) ?? 'weekly'
  const weekOffset = searchParams.get('week') ? Number(searchParams.get('week')) : 0
  const monthOffset = searchParams.get('month') ? Number(searchParams.get('month')) : 0

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  const offset = periodMode === 'weekly' ? weekOffset : monthOffset

  const { start, end, rangeLabel } = useMemo(() => {
    if (periodMode === 'monthly') {
      const now = new Date()
      const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
      const start = new Date(base.getFullYear(), base.getMonth(), 1)
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
      const rangeLabel = base.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
      return { start, end, rangeLabel }
    }
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    const { start, end } = weekRange(base)
    return { start, end, rangeLabel: `${formatDateHe(start)} – ${formatDateHe(end)}` }
  }, [periodMode, weekOffset, monthOffset])

  const periodTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = new Date(t.entry_datetime)
        return d >= start && d <= end
      }),
    [trades, start, end],
  )

  const totals = useMemo(() => computeDashboardTotals(periodTrades), [periodTrades])
  const successRate = useMemo(() => computeTradeSuccessRate(periodTrades), [periodTrades])
  const resultCounts = useMemo(() => computeResultCounts(periodTrades), [periodTrades])
  const profitFactor = useMemo(() => computeProfitFactor(periodTrades), [periodTrades])

  function goPrev() {
    if (periodMode === 'weekly') updateParams({ week: String(weekOffset - 1) })
    else updateParams({ month: String(monthOffset - 1) })
  }

  function goNext() {
    if (periodMode === 'weekly') updateParams({ week: String(weekOffset + 1) })
    else updateParams({ month: String(monthOffset + 1) })
  }

  async function handleExport() {
    if (!printableRef.current) return
    setExporting(true)
    try {
      const filename = `דוח-מסחר-${PERIOD_LABELS[periodMode]}-${start.toISOString().slice(0, 10)}.pdf`
      const { exportElementToPdf } = await import('../lib/exportPdf')
      await exportElementToPdf(printableRef.current, filename)
      toast.add({ title: 'הדוח יוצא בהצלחה', type: 'success' })
    } catch (err) {
      toast.add({
        title: 'שגיאה בייצוא הדוח',
        description: err instanceof Error ? err.message : undefined,
        type: 'error',
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 w-full rounded-xl" />
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
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">דוח מסחר תקופתי</h2>
        <Button type="button" onClick={handleExport} disabled={exporting || periodTrades.length === 0}>
          {exporting ? 'מייצא...' : 'ייצוא ל-PDF'}
        </Button>
      </div>

      <div className="flex gap-1 self-start rounded-lg border border-border bg-muted p-1">
        {(['weekly', 'monthly'] as ReportPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => updateParams({ period: p })}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              periodMode === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={goPrev}>
          ‹ {periodMode === 'weekly' ? 'שבוע' : 'חודש'} קודם
        </Button>
        <span className="min-w-[160px] text-center font-medium text-foreground" dir="ltr">
          {rangeLabel}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={goNext} disabled={offset >= 0}>
          {periodMode === 'weekly' ? 'שבוע' : 'חודש'} הבא ›
        </Button>
      </div>

      {periodTrades.length === 0 && (
        <EmptyState
          icon={CalendarX}
          title={`אין עסקאות ב${periodMode === 'weekly' ? 'שבוע' : 'חודש'} זה`}
          description="נסה/י לנווט לתקופה אחרת או להוסיף עסקאות."
        />
      )}

      <div ref={printableRef} className="relative rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="absolute top-4 right-4 h-10 w-10 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border">
          <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
        </div>

        <div className="mb-6 text-center">
          <h3 className="font-heading text-lg font-semibold text-foreground">
            דוח מסחר {PERIOD_LABELS[periodMode]} — ST Indicator
          </h3>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
            {rangeLabel}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReportStat
            label="רווח/הפסד כולל"
            value={formatCurrency(totals.totalPnl)}
            tone={totals.totalPnl > 0 ? 'positive' : totals.totalPnl < 0 ? 'negative' : 'neutral'}
          />
          <ReportStat
            label="Profit Factor"
            value={formatProfitFactor(profitFactor)}
            tone={profitFactor == null ? 'neutral' : profitFactor >= 1 ? 'positive' : 'negative'}
          />
          <ReportStat label="אחוז ימים רווחיים" value={formatPercent(totals.profitableDaysPct)} />
          <ReportStat
            label="אחוז רווח/הפסד"
            value={formatPercent(successRate)}
            tone={successRate == null ? 'neutral' : successRate >= 50 ? 'positive' : 'negative'}
          />
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
            <div className="text-xs text-muted-foreground">מספר עסקאות (מרוויחות / מפסידות / BE)</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              <span className="text-primary">{resultCounts.win}</span>
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-destructive">{resultCounts.loss}</span>
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-muted-foreground">{resultCounts.breakeven}</span>
            </div>
          </div>
          <ReportStat label="רווח ממוצע" value={formatCurrency(totals.avgWin)} tone="positive" />
          <ReportStat label="הפסד ממוצע" value={formatCurrency(totals.avgLoss)} tone="negative" />
          <ReportStat label="מספר עסקאות" value={String(totals.tradeCount)} />
        </div>

        {periodTrades.length > 0 && (
          <Table className="table-fixed text-xs">
            <colgroup>
              <col className="w-1/4" />
              <col className="w-1/5" />
              <col className="w-[30%]" />
              <col className="w-1/4" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs">תאריך</TableHead>
                <TableHead className="h-8 text-xs">כיוון</TableHead>
                <TableHead className="h-8 text-xs">PnL ($)</TableHead>
                <TableHead className="h-8 text-xs">תוצאה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodTrades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-foreground" dir="ltr">
                    {new Date(t.entry_datetime).toLocaleDateString('he-IL', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-foreground">{t.direction === 'Long' ? 'לונג' : 'שורט'}</TableCell>
                  <TableCell
                    className={`font-medium ${
                      (t.pnl_dollars ?? 0) > 0
                        ? 'text-primary'
                        : (t.pnl_dollars ?? 0) < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                    dir="ltr"
                  >
                    {t.pnl_dollars != null ? t.pnl_dollars.toLocaleString('en-US') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent text-[11px] ${resultClass[t.result]}`}>
                      {t.result}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function ReportStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneClass = tone === 'positive' ? 'text-primary' : tone === 'negative' ? 'text-destructive' : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`} dir="ltr">
        {value}
      </div>
    </div>
  )
}
