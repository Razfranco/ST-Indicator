export function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** לשימוש בפלטפורמת הניהול העסקי בלבד (שקלים) — formatCurrency נשאר לדולרים של מסחר */
export function formatILS(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₪`
}

export function formatPercent(value: number | null): string {
  if (value == null) return '—'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
}

export function formatProfitFactor(value: number | null): string {
  if (value == null) return '—'
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(2)
}

/** Date-only business display. Keep date columns literal; timestamps use Israel's business day. */
export function formatTrialExpiry(value: string | null): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}.${month}.${year}`
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('day')}.${part('month')}.${part('year')}`
}
