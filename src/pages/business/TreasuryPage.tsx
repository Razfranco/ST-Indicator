import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet } from 'lucide-react'
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
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
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
import type { TreasuryTransaction, TreasuryTransactionType } from '../../types/business.types'

const TYPES: TreasuryTransactionType[] = ['deposit', 'withdrawal']
const typeLabel: Record<TreasuryTransactionType, string> = {
  deposit: 'הפקדה',
  withdrawal: 'משיכה',
}
const typeClass: Record<TreasuryTransactionType, string> = {
  deposit: 'bg-primary/10 text-primary',
  withdrawal: 'bg-destructive/10 text-destructive',
}
const typeButtonClass: Record<TreasuryTransactionType, string> = {
  deposit: 'bg-primary text-primary-foreground',
  withdrawal: 'bg-destructive text-white',
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [typeFilter, setTypeFilter] = useState<TreasuryTransactionType | ''>(
    (searchParams.get('type') as TreasuryTransactionType) ?? '',
  )
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '')

  const [sortField, setSortField] = useState<SortField | null>((searchParams.get('sort') as SortField) ?? null)
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get('dir') as SortDir) ?? 'asc')

  const error = loadError ?? actionError

  useEffect(() => {
    const next = new URLSearchParams()
    if (typeFilter) next.set('type', typeFilter)
    if (fromDate) next.set('from', fromDate)
    if (toDate) next.set('to', toDate)
    if (sortField) next.set('sort', sortField)
    if (sortField) next.set('dir', sortDir)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, fromDate, toDate, sortField, sortDir])

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

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const allVisibleSelected = sorted.length > 0 && sorted.every((t) => selectedIds.has(t.id))
  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const t of sorted) {
        if (checked) next.add(t.id)
        else next.delete(t.id)
      }
      return next
    })
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
      toast.add({ title: 'שגיאה בשמירת התנועה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: editingId ? 'התנועה עודכנה בהצלחה' : 'התנועה נוספה בהצלחה', type: 'success' })
    cancelEdit()
  }

  async function handleDeleteMany(ids: string[]) {
    setDeletingIds(new Set(ids))
    const { error } = await supabase.from('treasury_transactions').delete().in('id', ids)
    setDeletingIds(new Set())
    setPendingDeleteIds(null)
    if (error) {
      setActionError(error.message)
      toast.add({ title: 'שגיאה במחיקה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: ids.length > 1 ? `${ids.length} תנועות נמחקו` : 'התנועה נמחקה', type: 'success' })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-semibold">קופה</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="יתרת קופה"
          value={formatILS(balance)}
          tone={balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}
        />
        <StatTile label="סה״כ הפקדות" value={formatILS(totalDeposits)} tone="positive" />
        <StatTile label="סה״כ משיכות" value={formatILS(totalWithdrawals)} tone="negative" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Section title={editingId ? 'עריכת תנועה' : 'תנועה חדשה'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="סוג" required>
              <div className="flex gap-1 rounded-lg border border-input bg-muted p-1">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update('type', t)}
                    className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                      form.type === t ? typeButtonClass[t] : 'text-muted-foreground'
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
            <Button type="submit" disabled={saving}>
              {saving ? 'שומר...' : editingId ? 'עדכון תנועה' : '+ הוספת תנועה'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                ביטול
              </Button>
            )}
          </div>
        </form>
      </Section>

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setPendingDeleteIds(Array.from(selectedIds))}
        >
          מחיקת נבחרים
        </Button>
      </BulkActionBar>

      <Card className="grid grid-cols-2 gap-3 p-3 shadow-sm sm:grid-cols-3">
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
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Wallet} title="אין תנועות להצגה" description="נסה/י לשנות את הסינון, או הוסף/י תנועה בטופס שלמעלה." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((t) => (
              <Card key={t.id} className="gap-2 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(checked: boolean) => toggleSelected(t.id, checked)}
                      aria-label="בחירת תנועה"
                    />
                    <Badge variant="outline" className={`border-transparent ${typeClass[t.type]}`}>
                      {typeLabel[t.type]}
                    </Badge>
                  </div>
                  <span
                    className={`font-semibold ${t.type === 'deposit' ? 'text-primary' : 'text-destructive'}`}
                    dir="ltr"
                  >
                    {formatILS(t.amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 text-xs">
                  <CardField label="תאריך">
                    <span dir="ltr">{t.transaction_date}</span>
                  </CardField>
                  <CardField label="הערה">{t.note ?? '—'}</CardField>
                </div>
                <div className="flex gap-3 border-t border-border px-4 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(t)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    עריכה
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDeleteIds([t.id])}
                    disabled={deletingIds.has(t.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    מחיקה
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-x-auto p-0 shadow-sm sm:block">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="בחירת הכל" />
                  </TableHead>
                  <SortHeader
                    label="תאריך"
                    field="transaction_date"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader label="סוג" field="type" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סכום" field="amount" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <TableHead>הערה</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={(checked: boolean) => toggleSelected(t.id, checked)}
                        aria-label="בחירת תנועה"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {t.transaction_date}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-transparent ${typeClass[t.type]}`}>
                        {typeLabel[t.type]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`font-medium ${t.type === 'deposit' ? 'text-primary' : 'text-destructive'}`}
                      dir="ltr"
                    >
                      {formatILS(t.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.note ?? '—'}</TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(t)}
                        className="me-2 text-muted-foreground hover:text-primary"
                      >
                        עריכה
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteIds([t.id])}
                        disabled={deletingIds.has(t.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        מחיקה
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <AlertDialog open={pendingDeleteIds != null} onOpenChange={(next: boolean) => !next && setPendingDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{(pendingDeleteIds?.length ?? 0) > 1 ? 'מחיקת תנועות' : 'מחיקת תנועה'}</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו אינה הפיכה. למחוק{' '}
              {(pendingDeleteIds?.length ?? 0) > 1 ? `${pendingDeleteIds?.length} תנועות נבחרות` : 'את התנועה'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDeleteIds && handleDeleteMany(pendingDeleteIds)}
            >
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
