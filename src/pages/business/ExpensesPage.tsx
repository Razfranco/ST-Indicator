import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useExpenses } from '../../lib/useExpenses'
import { useFixedExpenses } from '../../lib/useFixedExpenses'
import { countFixedExpenseOccurrences, currentMonthKey, monthKeyOf } from '../../lib/businessStats'
import { formatILS } from '../../lib/format'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Card } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { Checkbox } from '../../components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { EmptyState } from '../../components/EmptyState'
import { BulkActionBar } from '../../components/BulkActionBar'
import { toast } from '../../components/ui/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
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

type PendingDelete = { kind: 'variable' | 'fixed'; ids: string[] }

export function ExpensesPage() {
  const { expenses, loading, error: loadError } = useExpenses()
  const { fixedExpenses, loading: loadingFixed, error: loadFixedError } = useFixedExpenses()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') ?? currentMonthKey())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  const [editingFixedId, setEditingFixedId] = useState<string | null>(null)
  const [fixedForm, setFixedForm] = useState<FixedFormState>(emptyFixedForm)
  const [savingFixed, setSavingFixed] = useState(false)
  const [fixedActionError, setFixedActionError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const [selectedVariableIds, setSelectedVariableIds] = useState<Set<string>>(new Set())
  const [selectedFixedIds, setSelectedFixedIds] = useState<Set<string>>(new Set())

  const error = loadError ?? actionError ?? loadFixedError ?? fixedActionError

  useEffect(() => {
    const next = new URLSearchParams()
    if (filterMonth && filterMonth !== currentMonthKey()) next.set('month', filterMonth)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth])

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
      toast.add({ title: 'שגיאה בשמירת ההוצאה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: editingId ? 'ההוצאה עודכנה בהצלחה' : 'ההוצאה נוספה בהצלחה', type: 'success' })
    cancelEdit()
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
      toast.add({ title: 'שגיאה בשמירת ההוצאה הקבועה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: editingFixedId ? 'ההוצאה הקבועה עודכנה בהצלחה' : 'ההוצאה הקבועה נוספה בהצלחה', type: 'success' })
    cancelEditFixed()
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return
    const { kind, ids } = pendingDelete
    const table = kind === 'fixed' ? 'fixed_expenses' : 'additional_expenses'

    setDeletingIds(new Set(ids))
    const { error } = await supabase.from(table).delete().in('id', ids)
    setDeletingIds(new Set())
    setPendingDelete(null)

    if (error) {
      toast.add({ title: 'שגיאה במחיקה', description: error.message, type: 'error' })
      if (kind === 'fixed') setFixedActionError(error.message)
      else setActionError(error.message)
      return
    }

    toast.add({
      title: ids.length > 1 ? `${ids.length} הוצאות נמחקו` : 'ההוצאה נמחקה',
      type: 'success',
    })

    if (kind === 'fixed') {
      setSelectedFixedIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    } else {
      setSelectedVariableIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }

  function toggleFixedSelected(id: string, checked: boolean) {
    setSelectedFixedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const allFixedSelected = fixedExpenses.length > 0 && fixedExpenses.every((fe) => selectedFixedIds.has(fe.id))
  function toggleAllFixedSelected(checked: boolean) {
    setSelectedFixedIds((prev) => {
      const next = new Set(prev)
      for (const fe of fixedExpenses) {
        if (checked) next.add(fe.id)
        else next.delete(fe.id)
      }
      return next
    })
  }

  function toggleVariableSelected(id: string, checked: boolean) {
    setSelectedVariableIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const allVariableSelected = filtered.length > 0 && filtered.every((e) => selectedVariableIds.has(e.id))
  function toggleAllVariableSelected(checked: boolean) {
    setSelectedVariableIds((prev) => {
      const next = new Set(prev)
      for (const e of filtered) {
        if (checked) next.add(e.id)
        else next.delete(e.id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-semibold">הוצאות</h2>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Section title="הוצאות קבועות">
        <p className="text-xs text-muted-foreground">
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
            <Button type="submit" disabled={savingFixed}>
              {savingFixed ? 'שומר...' : editingFixedId ? 'עדכון הוצאה קבועה' : '+ הוספת הוצאה קבועה'}
            </Button>
            {editingFixedId && (
              <Button type="button" variant="outline" onClick={cancelEditFixed}>
                ביטול
              </Button>
            )}
          </div>
        </form>

        <BulkActionBar count={selectedFixedIds.size} onClear={() => setSelectedFixedIds(new Set())}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPendingDelete({ kind: 'fixed', ids: Array.from(selectedFixedIds) })}
          >
            מחיקת נבחרים
          </Button>
        </BulkActionBar>

        {loadingFixed ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : fixedExpenses.length === 0 ? (
          <EmptyState icon={Receipt} title="אין הוצאות קבועות" description="הוסף/י הוצאה קבועה בטופס שלמעלה." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allFixedSelected} onCheckedChange={toggleAllFixedSelected} aria-label="בחירת הכל" />
                  </TableHead>
                  <TableHead>הוצאה</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>תדירות</TableHead>
                  <TableHead>תאריך התחלה</TableHead>
                  <TableHead>הערה</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedExpenses.map((fe) => (
                  <TableRow key={fe.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedFixedIds.has(fe.id)}
                        onCheckedChange={(checked: boolean) => toggleFixedSelected(fe.id, checked)}
                        aria-label={`בחירת ${fe.expense_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{fe.expense_name}</TableCell>
                    <TableCell className="text-destructive" dir="ltr">
                      {formatILS(fe.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{recurrenceLabel[fe.recurrence]}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {fe.start_date}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fe.note ?? '—'}</TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditFixed(fe)}
                        className="me-2 text-muted-foreground hover:text-primary"
                      >
                        עריכה
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete({ kind: 'fixed', ids: [fe.id] })}
                        disabled={deletingIds.has(fe.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        מחיקה
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Button type="submit" disabled={saving}>
              {saving ? 'שומר...' : editingId ? 'עדכון הוצאה' : '+ הוספת הוצאה'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                ביטול
              </Button>
            )}
          </div>
        </form>
      </Section>

      <Card className="flex-row flex-wrap items-end justify-between gap-3 p-3 shadow-sm">
        <Field label="סינון לפי חודש">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="text-left">
          <div className="text-xs text-muted-foreground">
            משתנות {formatILS(variableTotal)} + קבועות {formatILS(fixedTotal)}
          </div>
          <div className="text-xl font-semibold text-destructive" dir="ltr">
            {formatILS(total)}
          </div>
        </div>
      </Card>

      {fixedThisMonth.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="min-w-[420px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>הוצאה קבועה (החודש)</TableHead>
                <TableHead>מופעים</TableHead>
                <TableHead>סה״כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fixedThisMonth.map(({ expense, occurrences, contribution }) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium text-foreground">{expense.expense_name}</TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {occurrences}
                  </TableCell>
                  <TableCell className="text-destructive" dir="ltr">
                    {formatILS(contribution)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BulkActionBar count={selectedVariableIds.size} onClear={() => setSelectedVariableIds(new Set())}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setPendingDelete({ kind: 'variable', ids: Array.from(selectedVariableIds) })}
        >
          מחיקת נבחרים
        </Button>
      </BulkActionBar>

      {loading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="אין הוצאות משתנות להצגה בחודש זה" description="הוסף/י הוצאה משתנה בטופס שלמעלה." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="min-w-[560px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allVariableSelected} onCheckedChange={toggleAllVariableSelected} aria-label="בחירת הכל" />
                </TableHead>
                <TableHead>הוצאה משתנה (החודש)</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>הערה</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVariableIds.has(e.id)}
                      onCheckedChange={(checked: boolean) => toggleVariableSelected(e.id, checked)}
                      aria-label={`בחירת ${e.expense_name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{e.expense_name}</TableCell>
                  <TableCell className="text-destructive" dir="ltr">
                    {formatILS(e.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.note}</TableCell>
                  <TableCell className="text-left">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(e)}
                      className="me-2 text-muted-foreground hover:text-primary"
                    >
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete({ kind: 'variable', ids: [e.id] })}
                      disabled={deletingIds.has(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      מחיקה
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={pendingDelete != null} onOpenChange={(next: boolean) => !next && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{(pendingDelete?.ids.length ?? 0) > 1 ? 'מחיקת הוצאות' : 'מחיקת הוצאה'}</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו אינה הפיכה. למחוק{' '}
              {(pendingDelete?.ids.length ?? 0) > 1 ? `${pendingDelete?.ids.length} הוצאות נבחרות` : 'את ההוצאה'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmPendingDelete}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
