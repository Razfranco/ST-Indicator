import { useMemo, useRef, useState } from 'react'
import { useTrades } from '../lib/useTrades'
import { computeDashboardTotals, computeTradeWinRate, weekRange } from '../lib/stats'
import { formatCurrency, formatPercent } from '../lib/format'
import type { TradeResult } from '../types/database.types'

const resultClass: Record<TradeResult, string> = {
  TP1: 'bg-emerald-950 text-emerald-400',
  TP2: 'bg-emerald-950 text-emerald-400',
  SL: 'bg-red-950 text-red-400',
  BE: 'bg-zinc-800 text-zinc-400',
}

function formatDateHe(d: Date): string {
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ReportPage() {
  const { trades, loading, error } = useTrades()
  const [weekOffset, setWeekOffset] = useState(0)
  const [exporting, setExporting] = useState(false)
  const printableRef = useRef<HTMLDivElement>(null)

  const { start, end } = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return weekRange(base)
  }, [weekOffset])

  const weekTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = new Date(t.entry_datetime)
        return d >= start && d <= end
      }),
    [trades, start, end],
  )

  const totals = useMemo(() => computeDashboardTotals(weekTrades), [weekTrades])
  const winRate = useMemo(() => computeTradeWinRate(weekTrades), [weekTrades])

  async function handleExport() {
    if (!printableRef.current) return
    setExporting(true)
    try {
      const filename = `דוח-מסחר-שבועי-${start.toISOString().slice(0, 10)}.pdf`
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
        <h2 className="text-xl font-bold">דוח מסחר שבועי</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || weekTrades.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {exporting ? 'מייצא...' : 'ייצוא ל-PDF'}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
        >
          ‹ שבוע קודם
        </button>
        <span className="min-w-[160px] text-center font-medium text-zinc-200" dir="ltr">
          {formatDateHe(start)} – {formatDateHe(end)}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset >= 0}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-30"
        >
          שבוע הבא ›
        </button>
      </div>

      {weekTrades.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">אין עסקאות בשבוע זה.</p>
      )}

      <div ref={printableRef} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-6 text-center">
          <h3 className="text-lg font-bold text-zinc-100">דוח מסחר שבועי — אינדיקטור יומי</h3>
          <p className="mt-1 text-sm text-zinc-500" dir="ltr">
            {formatDateHe(start)} – {formatDateHe(end)}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ReportStat
            label="רווח/הפסד כולל"
            value={formatCurrency(totals.totalPnl)}
            tone={totals.totalPnl > 0 ? 'positive' : totals.totalPnl < 0 ? 'negative' : 'neutral'}
          />
          <ReportStat label="אחוז הצלחה" value={formatPercent(winRate)} />
          <ReportStat label="מספר עסקאות" value={String(totals.tradeCount)} />
          <ReportStat label="רווח ממוצע" value={formatCurrency(totals.avgWin)} tone="positive" />
          <ReportStat label="הפסד ממוצע" value={formatCurrency(totals.avgLoss)} tone="negative" />
          <ReportStat label="ימים רווחיים" value={formatPercent(totals.profitableDaysPct)} />
        </div>

        {weekTrades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2 text-right font-medium">תאריך</th>
                  <th className="px-2 py-2 text-right font-medium">כיוון</th>
                  <th className="px-2 py-2 text-right font-medium">כניסה</th>
                  <th className="px-2 py-2 text-right font-medium">יציאה</th>
                  <th className="px-2 py-2 text-right font-medium">נקודות</th>
                  <th className="px-2 py-2 text-right font-medium">PnL ($)</th>
                  <th className="px-2 py-2 text-right font-medium">תוצאה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {weekTrades.map((t) => (
                  <tr key={t.id}>
                    <td className="px-2 py-1.5 text-zinc-300" dir="ltr">
                      {new Date(t.entry_datetime).toLocaleDateString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-300">
                      {t.direction === 'Long' ? 'לונג' : 'שורט'}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-300" dir="ltr">
                      {t.entry_price ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-300" dir="ltr">
                      {t.exit_price ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-300" dir="ltr">
                      {t.points ?? '—'}
                    </td>
                    <td
                      className={`px-2 py-1.5 font-medium ${
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
