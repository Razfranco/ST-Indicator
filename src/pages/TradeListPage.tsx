import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useTrades } from '../lib/useTrades'
import { RESULTS } from '../lib/constants'
import type { TradeResult } from '../types/database.types'
import { FilterField, filterInputClass, SortHeader } from '../components/BusinessFormControls'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
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

export function TradeListPage() {
  const { trades, loading, error: loadError } = useTrades()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [sortField, setSortField] = useState<SortField>('entry_datetime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [resultFilter, setResultFilter] = useState<TradeResult | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const error = loadError ?? deleteError

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('trades').delete().eq('id', id)
    setDeletingId(null)
    setConfirmDeleteId(null)
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
        <h2 className="font-heading text-xl font-semibold">עסקאות ({sorted.length})</h2>
        <Button render={<Link to="/performance/new" />}>+ עסקה חדשה</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/50 p-3 sm:grid-cols-3">
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
        <p className="py-10 text-center text-muted-foreground">אין עסקאות להצגה.</p>
      ) : (
        <div className="rounded-xl border border-border">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
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
                <TableRow key={t.id}>
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
                      onClick={() => setConfirmDeleteId(t.id)}
                      disabled={deletingId === t.id}
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

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open: boolean) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת עסקה</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה. למחוק את העסקה?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
