import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useTreasuryTransactions } from '../../lib/useTreasuryTransactions'
import { formatILS } from '../../lib/format'
import {
  Section,
  Field,
  inputClass,
  FilterField,
  filterInputClass,
  SortHeader,
  CardField,
} from '../../components/BusinessFormControls'
import type { SortDir } from '../../components/BusinessFormControls'
import { StatTile } from '../../components/StatTile'
import type { TreasuryTransaction, TreasuryTransactionType } from '../../types/business.types'

const TYPES: TreasuryTransactionType[] = ['deposit', 'withdrawal']
const typeLabel: Record<TreasuryTransactionType, string> = {
  deposit: 'הפקדה',
  withdrawal: 'משיכה',
}
const typeClass: Record<TreasuryTransactionType, string> = {
  deposit: 'bg-emerald-950 text-emerald-400',
  withdrawal: 'bg-red-950 text-red-400',
}
const typeButtonClass: Record<TreasuryTransactionType, string> = {
  deposit: 'bg-emerald-600 text-white',
  withdrawal: 'bg-red-600 text-white',
}

function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface FormState {
  type: TreasuryTransactionType
  amount: string
  transaction_date: string
  note: string
}

function emptyForm(): FormState {
  return { type: 'deposit', amount: '', transaction_date: todayDateInput(), note: '' }
}

function toForm(t: TreasuryTransaction): FormState {
  return {
    type: t.type,
    amount: String(t.amount),
    transaction_date: t.transaction_date,
    note: t.note ?? '',
  }
}

type SortField = 'transaction_date' | 'type' | 'amount'

export function TreasuryPage() {
  const { transactions, loading, error: loadError } = useTreasuryTransactions()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<TreasuryTransactionType | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const error = loadError ?? actionError

  const balance = useMemo(
    () =>
      transactions.reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0),
    [transactions],
  )
  const totalDeposits = useMemo(
    () => transactions.filter((t) => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  )
  const totalWithdrawals = useMemo(
    () => transactions.filter((t) => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  )

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false
      if (fromDate && t.transaction_date < fromDate) return false
      if (toDate && t.transaction_date > toDate) return false
      return true
    })
  }, [transactions, typeFilter, fromDate, toDate])

  const sorted = useMemo(() => {
    if (!sortField) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'transaction_date':
          cmp = a.transaction_date.localeCompare(b.transaction_date)
          break
        case 'type':
          cmp = typeLabel[a.type].localeCompare(typeLabel[b.type], 'he')
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function startEdit(t: TreasuryTransaction) {
    setEditingId(t.id)
    setForm(toForm(t))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setActionError(null)

    const payload = {
      type: form.type,
      amount: Number(form.amount),
      transaction_date: form.transaction_date,
      note: form.note.trim() || null,
    }

    const query = editingId
      ? supabase.from('treasury_transactions').update(payload).eq('id', editingId)
      : supabase.from('treasury_transactions').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את התנועה? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('treasury_transactions').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">קופה</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="יתרת קופה"
          value={formatILS(balance)}
          tone={balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}
        />
        <StatTile label="סה״כ הפקדות" value={formatILS(totalDeposits)} tone="positive" />
        <StatTile label="סה״כ משיכות" value={formatILS(totalWithdrawals)} tone="negative" />
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title={editingId ? 'עריכת תנועה' : 'תנועה חדשה'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="סוג" required>
              <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update('type', t)}
                    className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                      form.type === t ? typeButtonClass[t] : 'text-zinc-400'
                    }`}
                  >
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="סכום" required>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="תאריך" required>
              <input
                type="date"
                required
                value={form.transaction_date}
                onChange={(e) => update('transaction_date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="הערה">
              <input
                type="text"
                value={form.note}
                onChange={(e) => update('note', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'שומר...' : editingId ? 'עדכון תנועה' : '+ הוספת תנועה'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                ביטול
              </button>
            )}
          </div>
        </form>
      </Section>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-3">
        <FilterField label="סוג">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TreasuryTransactionType | '')}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel[t]}
              </option>
            ))}
          </select>
        </FilterField>
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
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען תנועות...</p>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין תנועות להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${typeClass[t.type]}`}>
                    {typeLabel[t.type]}
                  </span>
                  <span
                    className={`font-semibold ${t.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}
                    dir="ltr"
                  >
                    {formatILS(t.amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <CardField label="תאריך">
                    <span dir="ltr">{t.transaction_date}</span>
                  </CardField>
                  <CardField label="הערה">{t.note ?? '—'}</CardField>
                </div>
                <div className="flex gap-3 border-t border-zinc-800 pt-2">
                  <button onClick={() => startEdit(t)} className="text-xs text-zinc-400 hover:text-emerald-400">
                    עריכה
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 sm:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <SortHeader
                    label="תאריך"
                    field="transaction_date"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader label="סוג" field="type" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סכום" field="amount" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {t.transaction_date}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${typeClass[t.type]}`}>
                        {typeLabel[t.type]}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${t.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}
                      dir="ltr"
                    >
                      {formatILS(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{t.note ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-left">
                      <button
                        onClick={() => startEdit(t)}
                        className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                      >
                        עריכה
                      </button>
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
        </>
      )}
    </div>
  )
}
