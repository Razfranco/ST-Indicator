import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useExpenses } from '../../lib/useExpenses'
import { useFixedExpenses } from '../../lib/useFixedExpenses'
import { countFixedExpenseOccurrences, currentMonthKey, monthKeyOf } from '../../lib/businessStats'
import { formatILS } from '../../lib/format'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import type { AdditionalExpense, FixedExpense, FixedExpenseRecurrence } from '../../types/business.types'

const RECURRENCES: FixedExpenseRecurrence[] = ['weekly', 'monthly', 'yearly']
const recurrenceLabel: Record<FixedExpenseRecurrence, string> = {
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
}

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

interface FixedFormState {
  expense_name: string
  amount: string
  recurrence: FixedExpenseRecurrence
  start_date: string
  note: string
}

function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function emptyFixedForm(): FixedFormState {
  return { expense_name: '', amount: '', recurrence: 'monthly', start_date: todayDateInput(), note: '' }
}

function toFixedForm(expense: FixedExpense): FixedFormState {
  return {
    expense_name: expense.expense_name,
    amount: String(expense.amount),
    recurrence: expense.recurrence,
    start_date: expense.start_date,
    note: expense.note ?? '',
  }
}

export function ExpensesPage() {
  const { expenses, loading, error: loadError } = useExpenses()
  const { fixedExpenses, loading: loadingFixed, error: loadFixedError } = useFixedExpenses()

  const [filterMonth, setFilterMonth] = useState(currentMonthKey())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editingFixedId, setEditingFixedId] = useState<string | null>(null)
  const [fixedForm, setFixedForm] = useState<FixedFormState>(emptyFixedForm)
  const [savingFixed, setSavingFixed] = useState(false)
  const [deletingFixedId, setDeletingFixedId] = useState<string | null>(null)
  const [fixedActionError, setFixedActionError] = useState<string | null>(null)

  const error = loadError ?? actionError ?? loadFixedError ?? fixedActionError

  const filtered = useMemo(
    () => expenses.filter((e) => monthKeyOf(e.expense_month) === filterMonth),
    [expenses, filterMonth],
  )
  const variableTotal = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered])

  const { monthStart, monthEnd } = useMemo(() => {
    const [y, m] = filterMonth.split('-').map(Number)
    return {
      monthStart: new Date(y, m - 1, 1),
      monthEnd: new Date(y, m, 0, 23, 59, 59, 999),
    }
  }, [filterMonth])

  const fixedThisMonth = useMemo(
    () =>
      fixedExpenses
        .map((fe) => {
          const occurrences = countFixedExpenseOccurrences(fe.start_date, fe.recurrence, monthStart, monthEnd)
          return { expense: fe, occurrences, contribution: occurrences * fe.amount }
        })
        .filter((row) => row.occurrences > 0),
    [fixedExpenses, monthStart, monthEnd],
  )
  const fixedTotal = useMemo(
    () => fixedThisMonth.reduce((sum, row) => sum + row.contribution, 0),
    [fixedThisMonth],
  )

  const total = variableTotal + fixedTotal

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

  function updateFixed<K extends keyof FixedFormState>(key: K, value: FixedFormState[K]) {
    setFixedForm((f) => ({ ...f, [key]: value }))
  }

  function startEditFixed(expense: FixedExpense) {
    setEditingFixedId(expense.id)
    setFixedForm(toFixedForm(expense))
  }

  function cancelEditFixed() {
    setEditingFixedId(null)
    setFixedForm(emptyFixedForm())
  }

  async function handleSubmitFixed(e: FormEvent) {
    e.preventDefault()
    setSavingFixed(true)
    setFixedActionError(null)

    const payload = {
      expense_name: fixedForm.expense_name.trim(),
      amount: Number(fixedForm.amount),
      recurrence: fixedForm.recurrence,
      start_date: fixedForm.start_date,
      note: fixedForm.note.trim() || null,
    }

    const query = editingFixedId
      ? supabase.from('fixed_expenses').update(payload).eq('id', editingFixedId)
      : supabase.from('fixed_expenses').insert(payload)

    const { error } = await query
    setSavingFixed(false)

    if (error) {
      setFixedActionError(error.message)
      return
    }
    cancelEditFixed()
  }

  async function handleDeleteFixed(id: string) {
    if (!confirm('למחוק את ההוצאה הקבועה? פעולה זו אינה הפיכה.')) return
    setDeletingFixedId(id)
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
    setDeletingFixedId(null)
    if (error) setFixedActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">הוצאות</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title="הוצאות קבועות">
        <p className="text-xs text-zinc-500">
          הוצאה קבועה נוספת אוטומטית לכל תקופה (שבוע/חודש/שנה) מתאריך ההתחלה ואילך — אין צורך להזין
          אותה מחדש בכל פעם.
        </p>
        <form onSubmit={handleSubmitFixed} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Field label="הוצאה" required>
              <input
                type="text"
                required
                value={fixedForm.expense_name}
                onChange={(e) => updateFixed('expense_name', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="סכום" required>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                value={fixedForm.amount}
                onChange={(e) => updateFixed('amount', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="תקופת חידוש" required>
              <select
                value={fixedForm.recurrence}
                onChange={(e) => updateFixed('recurrence', e.target.value as FixedExpenseRecurrence)}
                className={inputClass}
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {recurrenceLabel[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="תאריך התחלה" required>
              <input
                type="date"
                required
                value={fixedForm.start_date}
                onChange={(e) => updateFixed('start_date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="הערה">
              <input
                type="text"
                value={fixedForm.note}
                onChange={(e) => updateFixed('note', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingFixed}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingFixed ? 'שומר...' : editingFixedId ? 'עדכון הוצאה קבועה' : '+ הוספת הוצאה קבועה'}
            </button>
            {editingFixedId && (
              <button
                type="button"
                onClick={cancelEditFixed}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                ביטול
              </button>
            )}
          </div>
        </form>

        {!loadingFixed && fixedExpenses.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">הוצאה</th>
                  <th className="px-3 py-2 text-right font-medium">סכום</th>
                  <th className="px-3 py-2 text-right font-medium">תדירות</th>
                  <th className="px-3 py-2 text-right font-medium">תאריך התחלה</th>
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {fixedExpenses.map((fe) => (
                  <tr key={fe.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 font-medium text-zinc-200">{fe.expense_name}</td>
                    <td className="px-3 py-2 text-red-400" dir="ltr">
                      {formatILS(fe.amount)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{recurrenceLabel[fe.recurrence]}</td>
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {fe.start_date}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{fe.note ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-left">
                      <button
                        onClick={() => startEditFixed(fe)}
                        className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => handleDeleteFixed(fe.id)}
                        disabled={deletingFixedId === fe.id}
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
      </Section>

      <Section title={editingId ? 'עריכת הוצאה משתנה' : 'הוצאה משתנה חדשה'}>
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
          <div className="text-xs text-zinc-500">
            משתנות {formatILS(variableTotal)} + קבועות {formatILS(fixedTotal)}
          </div>
          <div className="text-xl font-semibold text-red-400" dir="ltr">
            {formatILS(total)}
          </div>
        </div>
      </div>

      {fixedThisMonth.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">הוצאה קבועה (החודש)</th>
                <th className="px-3 py-2 text-right font-medium">מופעים</th>
                <th className="px-3 py-2 text-right font-medium">סה״כ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {fixedThisMonth.map(({ expense, occurrences, contribution }) => (
                <tr key={expense.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-medium text-zinc-200">{expense.expense_name}</td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {occurrences}
                  </td>
                  <td className="px-3 py-2 text-red-400" dir="ltr">
                    {formatILS(contribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען הוצאות...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין הוצאות משתנות להצגה בחודש זה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">הוצאה משתנה (החודש)</th>
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
                    {formatILS(e.amount)}
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
