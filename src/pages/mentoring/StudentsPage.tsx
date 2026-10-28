import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../lib/useStudents'
import { useCustomers } from '../../lib/useCustomers'
import { Modal } from '../../components/Modal'
import { Field, inputClass, FilterField, filterInputClass } from '../../components/BusinessFormControls'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { Checkbox } from '../../components/ui/checkbox'
import { toast } from '../../components/ui/toast'
import { EmptyState } from '../../components/EmptyState'
import { BulkActionBar } from '../../components/BulkActionBar'
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
import type { Student, StudentStatus } from '../../types/mentorship.types'

const STATUSES: StudentStatus[] = ['active', 'paused', 'ended']
const statusLabel: Record<StudentStatus, string> = { active: 'פעיל', paused: 'מושהה', ended: 'הסתיים' }
const statusClass: Record<StudentStatus, string> = {
  active: 'bg-primary/10 text-primary',
  paused: 'bg-amber-100 text-amber-800',
  ended: 'bg-muted text-muted-foreground',
}

interface FormState {
  display_name: string
  phone: string
  status: StudentStatus
  notes: string
  customer_id: string
}

function emptyForm(): FormState {
  return { display_name: '', phone: '', status: 'active', notes: '', customer_id: '' }
}

function toForm(s: Student): FormState {
  return {
    display_name: s.display_name,
    phone: s.phone ?? '',
    status: s.status,
    notes: s.notes ?? '',
    customer_id: s.customer_id ?? '',
  }
}

export function StudentsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { students, loading, error: loadError } = useStudents()
  const { customers } = useCustomers()

  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')

  const [editing, setEditing] = useState<Student | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const error = loadError ?? actionError

  const filtered = useMemo(
    () =>
      students.filter((s) => {
        if (nameFilter && !s.display_name.includes(nameFilter)) return false
        if (statusFilter && s.status !== statusFilter) return false
        return true
      }),
    [students, nameFilter, statusFilter],
  )

  const customerOptions = useMemo(
    () => [...customers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he')),
    [customers],
  )
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map((s) => s.id)))
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setCreating(true)
    setForm(emptyForm())
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm(toForm(s))
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setActionError(null)

    const payload = {
      display_name: form.display_name.trim(),
      phone: form.phone.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      customer_id: form.customer_id || null,
    }

    const query = editing
      ? supabase.from('students').update(payload).eq('id', editing.id)
      : supabase.from('students').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setActionError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: editing ? 'התלמיד עודכן' : 'התלמיד נוסף', type: 'success' })
    closeModal()
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setDeletingId(id)
    const { error } = await supabase.from('students').delete().eq('id', id)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (error) {
      setActionError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'התלמיד נמחק', type: 'success' })
  }

  async function confirmBulkDeleteAction() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    const { error } = await supabase.from('students').delete().in('id', ids)
    setBulkDeleting(false)
    setConfirmBulkDelete(false)
    if (error) {
      setActionError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: `${ids.length} תלמידים נמחקו`, type: 'success' })
    setSelectedIds(new Set())
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">תלמידים ({filtered.length})</h2>
        {isAdmin && <Button onClick={openCreate}>+ תלמיד חדש</Button>}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-2 gap-3 p-3 shadow-sm sm:grid-cols-3">
        <FilterField label="שם">
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="סטטוס">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StudentStatus | '')}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </FilterField>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="אין תלמידים להצגה"
          description={isAdmin ? 'נסה/י לשנות את הסינון, או הוסיפ/י תלמיד ראשון.' : 'נסה/י לשנות את הסינון.'}
          action={isAdmin ? <Button onClick={openCreate}>+ תלמיד ראשון</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {isAdmin && (
            <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
              <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDelete(true)} disabled={bulkDeleting}>
                מחיקת {selectedIds.size} תלמידים
              </Button>
            </BulkActionBar>
          )}
          {isAdmin && (
            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} />
              בחירת הכל
            </label>
          )}
          {filtered.map((s) => (
            <Card key={s.id} className="flex-row items-center justify-between gap-3 p-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                {isAdmin && <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.display_name}</span>
                    <Badge variant="outline" className={`border-transparent ${statusClass[s.status]}`}>
                      {statusLabel[s.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {s.phone && <span dir="ltr">{s.phone}</span>}
                    {s.notes && <span>{s.notes}</span>}
                    {isAdmin && s.customer_id && customerById.get(s.customer_id) && (
                      <span>לקוח: {customerById.get(s.customer_id)?.full_name}</span>
                    )}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-3">
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openEdit(s)}>
                    עריכה
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-destructive"
                    onClick={() => setConfirmDeleteId(s.id)}
                    disabled={deletingId === s.id}
                  >
                    מחיקה
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating || editing != null} onClose={closeModal} title={editing ? 'עריכת תלמיד' : 'תלמיד חדש'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="שם מלא" required>
            <input
              type="text"
              required
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="טלפון">
            <input
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="סטטוס" required>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={form.status === s ? 'default' : 'outline'}
                  onClick={() => update('status', s)}
                >
                  {statusLabel[s]}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="הערות">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
          {isAdmin && (
            <Field label="לקוח מקושר (CRM)" hint="לצורך דוח בקרת ליווי — איזה לקוח משלם זה התלמיד הזה.">
              <select
                value={form.customer_id}
                onChange={(e) => update('customer_id', e.target.value)}
                className={inputClass}
              >
                <option value="">— ללא קישור —</option>
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.plan})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'שומר...' : editing ? 'עדכון' : 'יצירה'}
            </Button>
            <Button type="button" variant="outline" onClick={closeModal}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(next: boolean) => !next && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת תלמיד</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה. למחוק את התלמיד?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת {selectedIds.size} תלמידים</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה. למחוק את כל התלמידים שנבחרו?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmBulkDeleteAction} disabled={bulkDeleting}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
