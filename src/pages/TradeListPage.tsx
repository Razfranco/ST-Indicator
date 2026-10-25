import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTrades } from '../lib/useTrades'
import { RESULTS } from '../lib/constants'
import type { TradeResult } from '../types/database.types'
import { FilterField, filterInputClass, SortHeader } from '../components/BusinessFormControls'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Checkbox } from '../components/ui/checkbox'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { EmptyState } from '../components/EmptyState'
import { BulkActionBar } from '../components/BulkActionBar'
import { toast } from '../components/ui/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'

type SortField = 'entry_datetime' | 'pnl_dollars' | 'points'
type SortDir = 'asc' | 'desc'

const resultClass: Record<TradeResult, string> = {
  TP1: 'bg-primary/10 text-primary',
  TP2: 'bg-primary/10 text-primary',
  SL: 'bg-destructive/10 text-destructive',
  BE: 'bg-muted text-muted-foreground',
}

type DeleteTarget = { type: 'single'; id: string } | { type: 'bulk'; ids: string[] } | null

export function TradeListPage() {
  const { trades, loading, error: loadError } = useTrades()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [searchParams, setSearchParams] = useSearchParams()
  const resultFilter = (searchParams.get('result') as TradeResult | null) ?? ''
  const fromDate = searchParams.get('from') ?? ''
  const toDate = searchParams.get('to') ?? ''
  const sortField = (searchParams.get('sort') as SortField | null) ?? 'entry_datetime'
  const sortDir = (searchParams.get('dir') as SortDir | null) ?? 'desc'

  const error = loadError ?? deleteError

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const ids = deleteTarget.type === 'single' ? [deleteTarget.id] : deleteTarget.ids
    setDeleting(true)
    const { error } = await supabase.from('trades').delete().in('id', ids)
    setDeleting(false)
    setDeleteTarget(null)

    if (error) {
      setDeleteError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    toast.add({
      title: ids.length > 1 ? `${ids.length} עסקאות נמחקו` : 'העסקה נמחקה',
      type: 'success',
    })
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
      updateParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: field, dir: 'desc' })
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const allVisibleSelected = sorted.length > 0 && sorted.every((t) => selectedIds.has(t.id))

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const t of sorted) {
        if (checked) next.add(t.id)
        else next.delete(t.id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">עסקאות ({sorted.length})</h2>
        <Button render={<Link to="/performance/new" />}>+ עסקה חדשה</Button>
      </div>

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteTarget({ type: 'bulk', ids: Array.from(selectedIds) })}
        >
          מחיקת נבחרות
        </Button>
      </BulkActionBar>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/50 p-3 sm:grid-cols-3">
        <FilterField label="מתאריך">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => updateParams({ from: e.target.value || null })}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="עד תאריך">
          <input
            type="date"
            value={toDate}
            onChange={(e) => updateParams({ to: e.target.value || null })}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="תוצאה">
          <select
            value={resultFilter}
            onChange={(e) => updateParams({ result: e.target.value || null })}
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="אין עסקאות להצגה"
          description="התחל/י לתעד את העסקאות שלך כדי לראות כאן נתונים וסטטיסטיקות."
          action={<Button render={<Link to="/performance/new" />}>+ עסקה ראשונה</Button>}
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                    aria-label="בחירת כל העסקאות המוצגות"
                  />
                </TableHead>
                <SortHeader label="תאריך כניסה" field="entry_datetime" current={sortField} dir={sortDir} onClick={toggleSort} />
                <TableHead>כיוון</TableHead>
                <TableHead>מחיר כניסה</TableHead>
                <TableHead>מחיר יציאה</TableHead>
                <TableHead>חוזים</TableHead>
                <SortHeader label="נקודות" field="points" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="PnL ($)" field="pnl_dollars" current={sortField} dir={sortDir} onClick={toggleSort} />
                <TableHead>תוצאה</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((t) => (
                <TableRow key={t.id} data-state={selectedIds.has(t.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(checked) => toggleSelect(t.id, checked === true)}
                      aria-label="בחירת עסקה"
                    />
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {new Date(t.entry_datetime).toLocaleString('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        t.direction === 'Long'
                          ? 'border-transparent bg-primary/10 text-primary'
                          : 'border-transparent bg-destructive/10 text-destructive'
                      }
                    >
                      {t.direction === 'Long' ? 'לונג' : 'שורט'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {t.entry_price ?? '—'}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {t.exit_price ?? '—'}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {t.position_size}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {t.points ?? '—'}
                  </TableCell>
                  <TableCell
                    className={`font-medium ${
                      (t.pnl_dollars ?? 0) > 0
                        ? 'text-primary'
                        : (t.pnl_dollars ?? 0) < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                    dir="ltr"
                  >
                    {t.pnl_dollars != null ? t.pnl_dollars.toLocaleString('en-US') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent ${resultClass[t.result]}`}>
                      {t.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="sm" render={<Link to={`/performance/edit/${t.id}`} />}>
                      עריכה
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget({ type: 'single', id: t.id })}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === 'bulk' ? 'מחיקת עסקאות' : 'מחיקת עסקה'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'bulk'
                ? `פעולה זו אינה הפיכה. למחוק ${deleteTarget.ids.length} עסקאות נבחרות?`
                : 'פעולה זו אינה הפיכה. למחוק את העסקה?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={handleConfirmDelete}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
