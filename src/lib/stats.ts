import type { Trade } from '../types/database.types'

export type Period = 'daily' | 'weekly' | 'monthly'
export type DashboardScope = Period | 'total'

export interface DashboardTotals {
  totalPnl: number
  profitableDaysPct: number | null
  avgWin: number | null
  avgLoss: number | null
  tradeCount: number
}

export interface PeriodPnlPoint {
  key: string
  label: string
  pnl: number
}

export interface PeriodResultPoint {
  key: string
  label: string
  win: number
  loss: number
  breakeven: number
}

export interface DayCell {
  dateKey: string
  dayOfMonth: number
  pnl: number
  tradeCount: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** תחילת השבוע (ראשון) עבור תאריך נתון */
function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

export function isWin(t: Trade): boolean {
  return t.result === 'TP1' || t.result === 'TP2'
}

export function isLoss(t: Trade): boolean {
  return t.result === 'SL'
}

/** ספירת עסקאות מרוויחות/מפסידות/ברייק-איבן מתוך קבוצת עסקאות נתונה */
export function computeResultCounts(trades: Trade[]): { win: number; loss: number; breakeven: number } {
  let win = 0
  let loss = 0
  let breakeven = 0
  for (const t of trades) {
    if (isWin(t)) win++
    else if (isLoss(t)) loss++
    else breakeven++
  }
  return { win, loss, breakeven }
}

/** אחוז עסקאות מרוויחות מתוך כלל העסקאות (TP1/TP2 מתוך הכל) */
export function computeTradeWinRate(trades: Trade[]): number | null {
  if (trades.length === 0) return null
  return (computeResultCounts(trades).win / trades.length) * 100
}

/** אחוז עסקאות מפסידות מתוך כלל העסקאות (SL מתוך הכל) */
export function computeTradeLossRate(trades: Trade[]): number | null {
  if (trades.length === 0) return null
  return (computeResultCounts(trades).loss / trades.length) * 100
}

/** אחוז עסקאות ברייק-איבן מתוך כלל העסקאות (BE מתוך הכל) */
export function computeTradeBreakevenRate(trades: Trade[]): number | null {
  if (trades.length === 0) return null
  return (computeResultCounts(trades).breakeven / trades.length) * 100
}

/** תאריכי תחילת/סוף השבוע (ראשון עד שבת) המכילים תאריך נתון */
export function weekRange(d: Date): { start: Date; end: Date } {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** תחום התאריכים של "התקופה הנוכחית" הנבחרת. total מחזיר null/null (ללא סינון) */
export function currentPeriodBounds(scope: DashboardScope): { start: Date | null; end: Date | null } {
  const now = new Date()
  if (scope === 'total') return { start: null, end: null }

  if (scope === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (scope === 'weekly') {
    return weekRange(now)
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export function filterTradesByRange(trades: Trade[], start: Date | null, end: Date | null): Trade[] {
  if (!start || !end) return trades
  return trades.filter((t) => {
    const d = new Date(t.entry_datetime)
    return d >= start && d <= end
  })
}

/** מדדים מסכמים עבור קבוצת עסקאות נתונה (מסוננת מראש לפי התקופה הנבחרת) */
export function computeDashboardTotals(trades: Trade[]): DashboardTotals {
  const tradeCount = trades.length
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_dollars ?? 0), 0)

  const wins = trades.filter((t) => (t.pnl_dollars ?? 0) > 0)
  const losses = trades.filter((t) => (t.pnl_dollars ?? 0) < 0)

  const avgWin = wins.length
    ? wins.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0) / wins.length
    : null
  const avgLoss = losses.length
    ? losses.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0) / losses.length
    : null

  const byDay = new Map<string, number>()
  for (const t of trades) {
    const key = dayKey(new Date(t.entry_datetime))
    byDay.set(key, (byDay.get(key) ?? 0) + (t.pnl_dollars ?? 0))
  }
  const daysWithTrades = byDay.size
  const profitableDays = [...byDay.values()].filter((pnl) => pnl > 0).length
  const profitableDaysPct = daysWithTrades ? (profitableDays / daysWithTrades) * 100 : null

  return { totalPnl, profitableDaysPct, avgWin, avgLoss, tradeCount }
}

const monthLabels = [
  'ינו',
  'פבר',
  'מרץ',
  'אפר',
  'מאי',
  'יונ',
  'יול',
  'אוג',
  'ספט',
  'אוק',
  'נוב',
  'דצמ',
]

function periodKeyAndLabel(d: Date, period: Period): { key: string; label: string } {
  if (period === 'daily') {
    const key = dayKey(d)
    return { key, label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` }
  }
  if (period === 'weekly') {
    const start = startOfWeek(d)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const key = dayKey(start)
    return {
      key,
      label: `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}–${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`,
    }
  }
  const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  return { key, label: `${monthLabels[d.getMonth()]} ${d.getFullYear()}` }
}

/** רווח/הפסד מקובץ לפי תקופה, ממוין כרונולוגית, N התקופות האחרונות שיש בהן עסקאות */
export function computePeriodPnl(trades: Trade[], period: Period, limit = 12): PeriodPnlPoint[] {
  const map = new Map<string, PeriodPnlPoint>()
  for (const t of trades) {
    const d = new Date(t.entry_datetime)
    const { key, label } = periodKeyAndLabel(d, period)
    const existing = map.get(key)
    if (existing) {
      existing.pnl += t.pnl_dollars ?? 0
    } else {
      map.set(key, { key, label, pnl: t.pnl_dollars ?? 0 })
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-limit)
}

/** ספירת עסקאות מרוויחות/מפסידות/ברייק-איבן, מקובצת לפי תקופה */
export function computePeriodResultCounts(
  trades: Trade[],
  period: Period,
  limit = 12,
): PeriodResultPoint[] {
  const map = new Map<string, PeriodResultPoint>()
  for (const t of trades) {
    const d = new Date(t.entry_datetime)
    const { key, label } = periodKeyAndLabel(d, period)
    const existing = map.get(key) ?? { key, label, win: 0, loss: 0, breakeven: 0 }
    if (isWin(t)) existing.win += 1
    else if (isLoss(t)) existing.loss += 1
    else existing.breakeven += 1
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-limit)
}

/** תאי היומן החודשי עבור חודש נתון (year, month מבוסס-0) */
export function computeMonthCalendar(
  trades: Trade[],
  year: number,
  month: number,
): { cells: DayCell[]; leadingBlanks: number; monthLabel: string } {
  const byDay = new Map<string, { pnl: number; count: number }>()
  for (const t of trades) {
    const d = new Date(t.entry_datetime)
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const key = dayKey(d)
    const existing = byDay.get(key) ?? { pnl: 0, count: 0 }
    existing.pnl += t.pnl_dollars ?? 0
    existing.count += 1
    byDay.set(key, existing)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: DayCell[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad2(month + 1)}-${pad2(day)}`
    const entry = byDay.get(key)
    cells.push({ dateKey: key, dayOfMonth: day, pnl: entry?.pnl ?? 0, tradeCount: entry?.count ?? 0 })
  }

  const leadingBlanks = new Date(year, month, 1).getDay()
  const monthLabel = `${monthLabels[month]} ${year}`

  return { cells, leadingBlanks, monthLabel }
}
