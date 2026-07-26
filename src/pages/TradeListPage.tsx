import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useTrades } from '../lib/useTrades'
import { RESULTS } from '../lib/constants'
import type { TradeResult } from '../types/database.types'

type SortField = 'entry_datetime' | 'pnl_dollars' | 'points'
type SortDir = 'asc' | 'desc'

const resultClass: Record<TradeResult, string> = {
  TP1: 'bg-emerald-950 text-emerald-400',
  TP2: 'bg-emerald-950 text-emerald-400',
  SL: 'bg-red-950 text-red-400',
  BE: 'bg-zinc-800 text-zinc-400',
}

export function TradeListPage() {
  const { trades, loading, error: loadError } = useTrades()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [sortField, setSortField] = useState<SortField>('entry_datetime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [resultFilter, setResultFilter] = useState<TradeResult | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const error = loadError ?? deleteError

  async function handleDelete(id: string) {
    if (!confirm('למחוק את העסקה? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('trades').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      setDeleteError(error.message)
    }
  }

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (resultFilter && t.result !== resultFilter) return false
      if (fromDate && new Date(t.entry_datetime) < new Date(fromDate)) return false
      if (toDate && new Date(t.entry_datetime) > new Date(toDate + 'T23:59:59')) return false
      return true
    })
  }, [trades, resultFilter, fromDate, toDate])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let av: number
      let bv: number
      if (sortField === 'entry_datetime') {
        av = new Date(a.entry_datetime).getTime()
        bv = new Date(b.entry_datetime).getTime()
      } else {
        av = a[sortField] ?? -Infinity
        bv = b[sortField] ?? -Infinity
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return copy
  }, [filtered, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">עסקאות ({sorted.length})</h2>
        <Link
          to="/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + עסקה חדשה
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-3">
        <FilterField label="מתאריך">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="עד תאריך">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="תוצאה">
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as TradeResult | '')}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען עסקאות...</p>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין עסקאות להצגה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <SortHeader label="תאריך כניסה" field="entry_datetime" current={sortField} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-right font-medium">כיוון</th>
                <th className="px-3 py-2 text-right font-medium">מחיר כניסה</th>
                <th className="px-3 py-2 text-right font-medium">מחיר יציאה</th>
                <th className="px-3 py-2 text-right font-medium">חוזים</th>
                <SortHeader label="נקודות" field="points" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="PnL ($)" field="pnl_dollars" current={sortField} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-right font-medium">תוצאה</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sorted.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 text-right text-zinc-300" dir="ltr">
                    {new Date(t.entry_datetime).toLocaleString('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        t.direction === 'Long'
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-red-950 text-red-400'
                      }`}
                    >
                      {t.direction === 'Long' ? 'לונג' : 'שורט'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300" dir="ltr">
                    {t.entry_price ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300" dir="ltr">
                    {t.exit_price ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300" dir="ltr">
                    {t.position_size}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300" dir="ltr">
                    {t.points ?? '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
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
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${resultClass[t.result]}`}>
                      {t.result}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-left">
                    <Link
                      to={`/edit/${t.id}`}
                      className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                    >
                      עריכה
                    </Link>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const filterInputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500'

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onClick: (field: SortField) => void
}) {
  const active = current === field
  return (
    <th className="px-3 py-2 text-right font-medium">
      <button
        onClick={() => onClick(field)}
        className={`flex items-center gap-1 whitespace-nowrap ${active ? 'text-emerald-400' : ''}`}
      >
        {label}
        {active && <span>{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
