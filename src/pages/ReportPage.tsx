import { useMemo, useRef, useState } from 'react'
import { useTrades } from '../lib/useTrades'
import {
  computeDashboardTotals,
  computeProfitFactor,
  computeResultCounts,
  computeTradeBreakevenRate,
  computeTradeLossRate,
  computeTradeWinRate,
  weekRange,
} from '../lib/stats'
import { formatCurrency, formatPercent, formatProfitFactor } from '../lib/format'
import type { TradeResult } from '../types/database.types'

const resultClass: Record<TradeResult, string> = {
  TP1: 'bg-emerald-950 text-emerald-400',
  TP2: 'bg-emerald-950 text-emerald-400',
  SL: 'bg-red-950 text-red-400',
  BE: 'bg-zinc-800 text-zinc-400',
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
  const [periodMode, setPeriodMode] = useState<ReportPeriod>('weekly')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [exporting, setExporting] = useState(false)
  const printableRef = useRef<HTMLDivElement>(null)

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
  const winRate = useMemo(() => computeTradeWinRate(periodTrades), [periodTrades])
  const lossRate = useMemo(() => computeTradeLossRate(periodTrades), [periodTrades])
  const breakevenRate = useMemo(() => computeTradeBreakevenRate(periodTrades), [periodTrades])
  const resultCounts = useMemo(() => computeResultCounts(periodTrades), [periodTrades])
  const profitFactor = useMemo(() => computeProfitFactor(periodTrades), [periodTrades])

  function goPrev() {
    if (periodMode === 'weekly') setWeekOffset((w) => w - 1)
    else setMonthOffset((m) => m - 1)
  }

  function goNext() {
    if (periodMode === 'weekly') setWeekOffset((w) => w + 1)
    else setMonthOffset((m) => m + 1)
  }

  async function handleExport() {
    if (!printableRef.current) return
    setExporting(true)
    try {
      const filename = `דוח-מסחר-${PERIOD_LABELS[periodMode]}-${start.toISOString().slice(0, 10)}.pdf`
      const { exportElementToPdf } = await import('../lib/exportPdf')
      await exportElementToPdf(printableRef.current, filename)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען נתונים...</p>
  }

  if (error) {
    return <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">דוח מסחר תקופתי</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || periodTrades.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {exporting ? 'מייצא...' : 'ייצוא ל-PDF'}
        </button>
      </div>

      <div className="flex gap-1 self-start rounded-lg border border-zinc-700 bg-zinc-800 p-1">
        {(['weekly', 'monthly'] as ReportPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodMode(p)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              periodMode === p ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
        >
          ‹ {periodMode === 'weekly' ? 'שבוע' : 'חודש'} קודם
        </button>
        <span className="min-w-[160px] text-center font-medium text-zinc-200" dir="ltr">
          {rangeLabel}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={offset >= 0}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-30"
        >
          {periodMode === 'weekly' ? 'שבוע' : 'חודש'} הבא ›
        </button>
      </div>

      {periodTrades.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">
          אין עסקאות ב{periodMode === 'weekly' ? 'שבוע' : 'חודש'} זה.
        </p>
      )}

      <div ref={printableRef} className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="absolute top-4 right-4 h-10 w-10 overflow-hidden rounded-lg bg-white p-1">
          <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
        </div>

        <div className="mb-6 text-center">
          <h3 className="text-lg font-bold text-zinc-100">דוח מסחר {PERIOD_LABELS[periodMode]} — ST Indicator</h3>
          <p className="mt-1 text-sm text-zinc-500" dir="ltr">
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <div className="text-xs text-zinc-500">מרוויחות מול מפסידות מול ברייק-איבן</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              <span className="text-emerald-400">{formatPercent(winRate)}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-red-400">{formatPercent(lossRate)}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-zinc-400">{formatPercent(breakevenRate)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <div className="text-xs text-zinc-500">מספר עסקאות (מרוויחות / מפסידות / BE)</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              <span className="text-emerald-400">{resultCounts.win}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-red-400">{resultCounts.loss}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-zinc-400">{resultCounts.breakeven}</span>
            </div>
          </div>
          <ReportStat label="רווח ממוצע" value={formatCurrency(totals.avgWin)} tone="positive" />
          <ReportStat label="הפסד ממוצע" value={formatCurrency(totals.avgLoss)} tone="negative" />
          <ReportStat label="מספר עסקאות" value={String(totals.tradeCount)} />
        </div>

        {periodTrades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] table-fixed text-xs">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/5" />
                <col className="w-[30%]" />
                <col className="w-1/4" />
              </colgroup>
              <thead className="text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2 text-right font-medium">תאריך</th>
                  <th className="px-2 py-2 text-right font-medium">כיוון</th>
                  <th className="px-2 py-2 text-right font-medium">PnL ($)</th>
                  <th className="px-2 py-2 text-right font-medium">תוצאה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {periodTrades.map((t) => (
                  <tr key={t.id}>
                    <td className="px-2 py-1.5 text-right text-zinc-300" dir="ltr">
                      {new Date(t.entry_datetime).toLocaleDateString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-300">
                      {t.direction === 'Long' ? 'לונג' : 'שורט'}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-medium ${
                        (t.pnl_dollars ?? 0) > 0
                          ? 'text-emerald-400'
                          : (t.pnl_dollars ?? 0) < 0
                            ? 'text-red-400'
                            : 'text-zinc-400'
                      }`}
                      dir="ltr"
                    >
                      {t.pnl_dollars != null ? t.pnl_dollars.toLocaleString('en-US') : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${resultClass[t.result]}`}>
                        {t.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const toneClass =
    tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-zinc-100'
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`} dir="ltr">
        {value}
      </div>
    </div>
  )
}
