import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useLeads } from '../../lib/useLeads'
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
import { Modal } from '../../components/Modal'
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
import { followUpCountdown, leadNeedsAttention } from '../../lib/businessStats'
import type { Lead, LeadStatus } from '../../types/business.types'

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUSES: LeadStatus[] = ['relevant', 'not_relevant', 'trial_week']
const statusLabel: Record<LeadStatus, string> = {
  relevant: 'רלוונטי',
  not_relevant: 'לא רלוונטי',
  trial_week: 'תקופת ניסיון',
}
const statusClass: Record<LeadStatus, string> = {
  relevant: 'bg-primary/10 text-primary',
  not_relevant: 'bg-muted text-muted-foreground',
  trial_week: 'bg-sky-100 text-sky-800',
}
const statusButtonClass: Record<LeadStatus, string> = {
  relevant: 'bg-primary text-primary-foreground',
  not_relevant: 'bg-muted-foreground text-white',
  trial_week: 'bg-sky-700 text-white',
}

interface FormState {
  full_name: string
  phone: string
  source: string
  note: string
  follow_up: string
  follow_up_at: string
  status: LeadStatus
  trial_week_expiry: string
  handled: boolean
}

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  source: '',
  note: '',
  follow_up: '',
  follow_up_at: '',
  status: 'relevant',
  trial_week_expiry: '',
  handled: false,
}

function toForm(lead: Lead): FormState {
  return {
    full_name: lead.full_name,
    phone: lead.phone,
    source: lead.source,
    note: lead.note ?? '',
    follow_up: lead.follow_up ?? '',
    follow_up_at: toDatetimeLocalValue(lead.follow_up_at),
    status: lead.status,
    trial_week_expiry: lead.trial_week_expiry ?? '',
    handled: lead.handled,
  }
}

function toPayload(form: FormState) {
  return {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    source: form.source.trim(),
    note: form.note || null,
    follow_up: form.follow_up || null,
    follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
    status: form.status,
    trial_week_expiry: form.status === 'trial_week' ? form.trial_week_expiry || null : null,
    handled: form.handled,
  }
}

type SortField = 'full_name' | 'source' | 'status' | 'follow_up_at' | 'trial_week_expiry'

function compareNullableTime(a: string | null, b: string | null): number {
  const at = a ? new Date(a).getTime() : Infinity
  const bt = b ? new Date(b).getTime() : Infinity
  return at - bt
}

function FollowUpCell({ followUpAt }: { followUpAt: string | null }) {
  if (!followUpAt) return <span className="text-muted-foreground">—</span>
  const countdown = followUpCountdown(followUpAt)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground" dir="ltr">
        {new Date(followUpAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
      <Badge
        variant="outline"
        className={`w-fit border-transparent ${
          countdown.overdue
            ? 'bg-destructive/10 text-destructive'
            : countdown.dueSoon
              ? 'bg-orange-100 text-orange-800'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {countdown.label}
      </Badge>
    </div>
  )
}

function LeadCard({
  lead: l,
  selected,
  onToggleSelected,
  onEdit,
  onDelete,
  deleting,
}: {
  lead: Lead
  selected: boolean
  onToggleSelected: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const needsAttention = leadNeedsAttention(l)
  return (
    <Card className={`gap-2 p-3 shadow-sm ${needsAttention ? 'border-e-2 border-e-destructive bg-destructive/5' : ''}`}>
      <div className="flex items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <Checkbox checked={selected} onCheckedChange={onToggleSelected} aria-label={`בחירת ${l.full_name}`} />
          <span className="font-medium text-foreground">{l.full_name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {needsAttention && (
            <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
              דורש טיפול
            </Badge>
          )}
          <Badge variant="outline" className={`border-transparent ${statusClass[l.status]}`}>
            {statusLabel[l.status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 text-xs">
        <CardField label="טלפון">
          <span dir="ltr">{l.phone}</span>
        </CardField>
        <CardField label="מקור">{l.source}</CardField>
        <CardField label="תוקף תקופת ניסיון">
          <span dir="ltr">{l.status === 'trial_week' ? (l.trial_week_expiry ?? '—') : '—'}</span>
        </CardField>
        <CardField label="מועד פולו-אפ">
          <FollowUpCell followUpAt={l.follow_up_at} />
        </CardField>
      </div>

      {(l.follow_up || l.note) && (
        <div className="flex flex-col gap-1 border-t border-border px-4 pt-2 text-xs text-muted-foreground">
          {l.follow_up && (
            <p>
              <span className="text-muted-foreground/80">הערת פולו-אפ: </span>
              {l.follow_up}
            </p>
          )}
          {l.note && (
            <p>
              <span className="text-muted-foreground/80">הערה: </span>
              {l.note}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 border-t border-border px-4 pt-2">
        <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground hover:text-primary">
          עריכה
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="text-muted-foreground hover:text-destructive"
        >
          מחיקה
        </Button>
      </div>
    </Card>
  )
}

function LeadFormFields({
  form,
  update,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="שם מלא" required>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="טלפון" required>
          <input
            type="tel"
            dir="ltr"
            required
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="מקור" required hint="לדוגמה: אינסטגרם, המלצה">
          <input
            type="text"
            required
            value={form.source}
            onChange={(e) => update('source', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="הערת פולו-אפ">
          <input
            type="text"
            value={form.follow_up}
            onChange={(e) => update('follow_up', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="תאריך ושעה לפולו-אפ" hint="למשל: מועד לחזור אליו או שיחת מכירה שנקבעה">
          <input
            type="datetime-local"
            value={form.follow_up_at}
            onChange={(e) => update('follow_up_at', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="סטטוס" required>
          <div className="flex gap-1 rounded-lg border border-input bg-muted p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update('status', s)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  form.status === s ? statusButtonClass[s] : 'text-muted-foreground'
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </Field>
        {form.status === 'trial_week' && (
          <Field label="תוקף תקופת ניסיון" required>
            <input
              type="date"
              required
              value={form.trial_week_expiry}
              onChange={(e) => update('trial_week_expiry', e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
      </div>
      <Field label="הערה">
        <textarea
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>
      <label className="flex w-fit items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
        <input
          type="checkbox"
          checked={form.handled}
          onChange={(e) => update('handled', e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-sm text-foreground">טופל — לא דורש טיפול בחלונית ההתראות</span>
      </label>
    </>
  )
}

export function LeadsPage() {
  const { leads, loading, error: loadError } = useLeads()
  const [searchParams, setSearchParams] = useSearchParams()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [focusLeadId, setFocusLeadId] = useState(() => searchParams.get('focus'))

  const [nameFilter, setNameFilter] = useState(searchParams.get('name') ?? '')
  const [phoneFilter, setPhoneFilter] = useState(searchParams.get('phone') ?? '')
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') ?? '')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>((searchParams.get('status') as LeadStatus) ?? '')
  const [followUpFilter, setFollowUpFilter] = useState(searchParams.get('followUp') ?? '')

  const [sortField, setSortField] = useState<SortField | null>((searchParams.get('sort') as SortField) ?? null)
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get('dir') as SortDir) ?? 'asc')

  const error = loadError ?? actionError

  useEffect(() => {
    const next = new URLSearchParams()
    if (nameFilter) next.set('name', nameFilter)
    if (phoneFilter) next.set('phone', phoneFilter)
    if (sourceFilter) next.set('source', sourceFilter)
    if (statusFilter) next.set('status', statusFilter)
    if (followUpFilter) next.set('followUp', followUpFilter)
    if (sortField) next.set('sort', sortField)
    if (sortField) next.set('dir', sortDir)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter, phoneFilter, sourceFilter, statusFilter, followUpFilter, sortField, sortDir])

  const sourceOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).sort(),
    [leads],
  )

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (nameFilter && !l.full_name.includes(nameFilter)) return false
      if (phoneFilter && !l.phone.includes(phoneFilter)) return false
      if (sourceFilter && l.source !== sourceFilter) return false
      if (statusFilter && l.status !== statusFilter) return false
      if (followUpFilter && !(l.follow_up ?? '').includes(followUpFilter)) return false
      return true
    })
  }, [leads, nameFilter, phoneFilter, sourceFilter, statusFilter, followUpFilter])

  const sorted = useMemo(() => {
    if (!sortField) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'full_name':
          cmp = a.full_name.localeCompare(b.full_name, 'he')
          break
        case 'source':
          cmp = a.source.localeCompare(b.source, 'he')
          break
        case 'status':
          cmp = statusLabel[a.status].localeCompare(statusLabel[b.status], 'he')
          break
        case 'follow_up_at':
          cmp = compareNullableTime(a.follow_up_at, b.follow_up_at)
          break
        case 'trial_week_expiry':
          cmp = compareNullableTime(a.trial_week_expiry, b.trial_week_expiry)
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

  const allVisibleSelected = sorted.length > 0 && sorted.every((l) => selectedIds.has(l.id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const l of sorted) {
        if (checked) next.add(l.id)
        else next.delete(l.id)
      }
      return next
    })
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateEdit<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditForm((f) => ({ ...f, [key]: value }))
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead)
    setEditForm(toForm(lead))
    setEditError(null)
  }

  function closeEdit() {
    setEditingLead(null)
  }

  useEffect(() => {
    if (!focusLeadId) return
    const lead = leads.find((l) => l.id === focusLeadId)
    if (lead) {
      openEdit(lead)
      setFocusLeadId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLeadId, leads])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setActionError(null)

    const { error } = await supabase.from('leads').insert(toPayload(form))
    setSaving(false)

    if (error) {
      setActionError(error.message)
      toast.add({ title: 'שגיאה בהוספת הליד', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'הליד נוסף בהצלחה', type: 'success' })
    setForm(emptyForm)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editingLead) return
    setSavingEdit(true)
    setEditError(null)

    const payload = toPayload(editForm)
    // פולו-אפ חדש שהוזז לעתיד ("הארכת תוקף") מאפס את "טופל" — זו הודעה חדשה שעדיין לא נסגרה.
    if (
      payload.follow_up_at &&
      payload.follow_up_at !== editingLead.follow_up_at &&
      new Date(payload.follow_up_at) > new Date()
    ) {
      payload.handled = false
    }

    const { error } = await supabase.from('leads').update(payload).eq('id', editingLead.id)
    setSavingEdit(false)

    if (error) {
      setEditError(error.message)
      toast.add({ title: 'שגיאה בעדכון הליד', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'הליד עודכן בהצלחה', type: 'success' })
    closeEdit()
  }

  async function handleDeleteMany(ids: string[]) {
    setDeletingIds(new Set(ids))
    const { error } = await supabase.from('leads').delete().in('id', ids)
    setDeletingIds(new Set())
    setPendingDeleteIds(null)
    if (error) {
      toast.add({ title: 'שגיאה במחיקה', description: error.message, type: 'error' })
      setActionError(error.message)
      return
    }
    toast.add({ title: ids.length > 1 ? `${ids.length} לידים נמחקו` : 'הליד נמחק', type: 'success' })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-semibold">לידים ({filtered.length})</h2>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Section title="ליד חדש">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <LeadFormFields form={form} update={update} />
          <Button type="submit" disabled={saving} className="self-start">
            {saving ? 'שומר...' : '+ הוספת ליד'}
          </Button>
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

      <Card className="grid grid-cols-2 gap-3 p-3 shadow-sm sm:grid-cols-5">
        <FilterField label="שם מלא">
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="טלפון">
          <input
            type="text"
            dir="ltr"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            className={filterInputClass}
          />
        </FilterField>
        <FilterField label="מקור">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="סטטוס">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
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
        <FilterField label="פולו-אפ">
          <input
            type="text"
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value)}
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
        <EmptyState icon={UserPlus} title="אין לידים להצגה" description="נסה/י לשנות את הסינון, או הוסף/י ליד חדש למעלה." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                selected={selectedIds.has(l.id)}
                onToggleSelected={(checked) => toggleSelected(l.id, checked)}
                onEdit={() => openEdit(l)}
                onDelete={() => setPendingDeleteIds([l.id])}
                deleting={deletingIds.has(l.id)}
              />
            ))}
          </div>

          <Card className="hidden overflow-x-auto p-0 shadow-sm sm:block">
            <Table className="min-w-[1020px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="בחירת הכל" />
                  </TableHead>
                  <SortHeader label="שם מלא" field="full_name" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <TableHead>טלפון</TableHead>
                  <SortHeader label="מקור" field="source" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader
                    label="תוקף תקופת ניסיון"
                    field="trial_week_expiry"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortHeader
                    label="מועד פולו-אפ"
                    field="follow_up_at"
                    current={sortField}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <TableHead>הערת פולו-אפ</TableHead>
                  <TableHead>הערה</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((l) => {
                  const needsAttention = leadNeedsAttention(l)
                  return (
                  <TableRow key={l.id} className={needsAttention ? 'border-e-2 border-e-destructive bg-destructive/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(l.id)}
                        onCheckedChange={(checked: boolean) => toggleSelected(l.id, checked)}
                        aria-label={`בחירת ${l.full_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{l.full_name}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {l.phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.source}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {needsAttention && (
                          <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                            דורש טיפול
                          </Badge>
                        )}
                        <Badge variant="outline" className={`border-transparent ${statusClass[l.status]}`}>
                          {statusLabel[l.status]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {l.status === 'trial_week' ? (l.trial_week_expiry ?? '—') : '—'}
                    </TableCell>
                    <TableCell>
                      <FollowUpCell followUpAt={l.follow_up_at} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.follow_up ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{l.note ?? '—'}</TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(l)}
                        className="me-2 text-muted-foreground hover:text-primary"
                      >
                        עריכה
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteIds([l.id])}
                        disabled={deletingIds.has(l.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        מחיקה
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Modal open={editingLead != null} onClose={closeEdit} title="עריכת ליד">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {editError && (
            <Alert variant="destructive">
              <AlertDescription className="text-destructive">{editError}</AlertDescription>
            </Alert>
          )}
          <LeadFormFields form={editForm} update={updateEdit} />
          <div className="flex gap-2">
            <Button type="submit" disabled={savingEdit}>
              {savingEdit ? 'שומר...' : 'עדכון ליד'}
            </Button>
            <Button type="button" variant="outline" onClick={closeEdit}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>

      <AlertDialog open={pendingDeleteIds != null} onOpenChange={(next: boolean) => !next && setPendingDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{(pendingDeleteIds?.length ?? 0) > 1 ? 'מחיקת לידים' : 'מחיקת ליד'}</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו אינה הפיכה. למחוק{' '}
              {(pendingDeleteIds?.length ?? 0) > 1 ? `${pendingDeleteIds?.length} לידים נבחרים` : 'את הליד'}?
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
