import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useExpenses } from '../../lib/useExpenses'
import { currentMonthKey, monthKeyOf } from '../../lib/businessStats'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import type { AdditionalExpense } from '../../types/business.types'

interface FormState {
  expense_name: string
  amount: string
  note: string
  expense_month: string
}

function emptyForm(): FormState {
  return { expense_name: '', amount: '', note: '', expense_month: currentMonthKey() }
}

function toForm(expense: AdditionalExpense): FormState {
  return {
    expense_name: expense.expense_name,
    amount: String(expense.amount),
    note: expense.note,
    expense_month: monthKeyOf(expense.expense_month),
  }
}

export function ExpensesPage() {
  const { expenses, loading, error: loadError } = useExpenses()
  const [filterMonth, setFilterMonth] = useState(currentMonthKey())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const error = loadError ?? actionError

  const filtered = useMemo(
    () => expenses.filter((e) => monthKeyOf(e.expense_month) === filterMonth),
    [expenses, filterMonth],
  )

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function startEdit(expense: AdditionalExpense) {
    setEditingId(expense.id)
    setForm(toForm(expense))
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
      expense_name: form.expense_name.trim(),
      amount: Number(form.amount),
      note: form.note.trim(),
      expense_month: `${form.expense_month}-01`,
    }

    const query = editingId
      ? supabase.from('additional_expenses').update(payload).eq('id', editingId)
      : supabase.from('additional_expenses').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את ההוצאה? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('additional_expenses').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">הוצאות נוספות</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title={editingId ? 'עריכת הוצאה' : 'הוצאה חדשה'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="הוצאה" required>
              <input
                type="text"
                required
                value={form.expense_name}
                onChange={(e) => update('expense_name', e.target.value)}
                className={inputClass}
              />
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
            <Field label="חודש" required>
              <input
                type="month"
                required
                value={form.expense_month}
                onChange={(e) => update('expense_month', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="הערה" required>
              <input
                type="text"
                required
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
              {saving ? 'שומר...' : editingId ? 'עדכון הוצאה' : '+ הוספת הוצאה'}
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

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <Field label="סינון לפי חודש">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="text-left">
          <div className="text-xs text-zinc-500">סה״כ הוצאות לחודש</div>
          <div className="text-xl font-semibold text-red-400" dir="ltr">
            ${total.toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען הוצאות...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין הוצאות להצגה בחודש זה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">הוצאה</th>
                <th className="px-3 py-2 text-right font-medium">סכום</th>
                <th className="px-3 py-2 text-right font-medium">הערה</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-medium text-zinc-200">{e.expense_name}</td>
                  <td className="px-3 py-2 text-red-400" dir="ltr">
                    ${e.amount.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{e.note}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-left">
                    <button
                      onClick={() => startEdit(e)}
                      className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
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
