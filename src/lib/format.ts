export function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
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
