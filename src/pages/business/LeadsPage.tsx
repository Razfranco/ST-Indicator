import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
import { followUpCountdown } from '../../lib/businessStats'
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
  trial_week: 'שבוע ניסיון',
}
const statusClass: Record<LeadStatus, string> = {
  relevant: 'bg-emerald-950 text-emerald-400',
  not_relevant: 'bg-zinc-800 text-zinc-400',
  trial_week: 'bg-sky-950 text-sky-400',
}
const statusButtonClass: Record<LeadStatus, string> = {
  relevant: 'bg-emerald-600 text-white',
  not_relevant: 'bg-zinc-600 text-white',
  trial_week: 'bg-sky-600 text-white',
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
  }
}

type SortField = 'full_name' | 'source' | 'status' | 'follow_up_at' | 'trial_week_expiry'

function compareNullableTime(a: string | null, b: string | null): number {
  const at = a ? new Date(a).getTime() : Infinity
  const bt = b ? new Date(b).getTime() : Infinity
  return at - bt
}

function FollowUpCell({ followUpAt }: { followUpAt: string | null }) {
  if (!followUpAt) return <span className="text-zinc-500">—</span>
  const countdown = followUpCountdown(followUpAt)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-zinc-300" dir="ltr">
        {new Date(followUpAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
      <span
        className={`w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${
          countdown.overdue
            ? 'bg-red-950 text-red-400'
            : countdown.dueSoon
              ? 'bg-orange-950 text-orange-400'
              : 'bg-zinc-800 text-zinc-400'
        }`}
      >
        {countdown.label}
      </span>
    </div>
  )
}

function LeadCard({
  lead: l,
  onEdit,
  onDelete,
  deleting,
}: {
  lead: Lead
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-200">{l.full_name}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[l.status]}`}>
          {statusLabel[l.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <CardField label="טלפון">
          <span dir="ltr">{l.phone}</span>
        </CardField>
        <CardField label="מקור">{l.source}</CardField>
        <CardField label="תוקף שבוע ניסיון">
          <span dir="ltr">{l.status === 'trial_week' ? (l.trial_week_expiry ?? '—') : '—'}</span>
        </CardField>
        <CardField label="מועד פולו-אפ">
          <FollowUpCell followUpAt={l.follow_up_at} />
        </CardField>
      </div>

      {(l.follow_up || l.note) && (
        <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
          {l.follow_up && (
            <p>
              <span className="text-zinc-500">הערת פולו-אפ: </span>
              {l.follow_up}
            </p>
          )}
          {l.note && (
            <p>
              <span className="text-zinc-500">הערה: </span>
              {l.note}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 border-t border-zinc-800 pt-2">
        <button onClick={onEdit} className="text-xs text-zinc-400 hover:text-emerald-400">
          עריכה
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
        >
          מחיקה
        </button>
      </div>
    </div>
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
          <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update('status', s)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  form.status === s ? statusButtonClass[s] : 'text-zinc-400'
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </Field>
        {form.status === 'trial_week' && (
          <Field label="תוקף שבוע ניסיון" required>
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
    </>
  )
}

export function LeadsPage() {
  const { leads, loading, error: loadError } = useLeads()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [nameFilter, setNameFilter] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [followUpFilter, setFollowUpFilter] = useState('')

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const error = loadError ?? actionError

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setActionError(null)

    const { error } = await supabase.from('leads').insert(toPayload(form))
    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    setForm(emptyForm)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editingLead) return
    setSavingEdit(true)
    setEditError(null)

    const { error } = await supabase.from('leads').update(toPayload(editForm)).eq('id', editingLead.id)
    setSavingEdit(false)

    if (error) {
      setEditError(error.message)
      return
    }
    closeEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הליד? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('leads').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">לידים ({filtered.length})</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title="ליד חדש">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <LeadFormFields form={form} update={update} />
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'שומר...' : '+ הוספת ליד'}
          </button>
        </form>
      </Section>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-5">
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
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען לידים...</p>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין לידים להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onEdit={() => openEdit(l)}
                onDelete={() => handleDelete(l.id)}
                deleting={deletingId === l.id}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 sm:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <SortHeader label="שם מלא" field="full_name" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">טלפון</th>
                  <SortHeader label="מקור" field="source" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortHeader
                    label="תוקף שבוע ניסיון"
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
                  <th className="px-3 py-2 text-right font-medium">הערת פולו-אפ</th>
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 font-medium text-zinc-200">{l.full_name}</td>
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {l.phone}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{l.source}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[l.status]}`}>
                        {statusLabel[l.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {l.status === 'trial_week' ? (l.trial_week_expiry ?? '—') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <FollowUpCell followUpAt={l.follow_up_at} />
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{l.follow_up ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-400">{l.note ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-left">
                      <button
                        onClick={() => openEdit(l)}
                        className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => handleDelete(l.id)}
                        disabled={deletingId === l.id}
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

      <Modal open={editingLead != null} onClose={closeEdit} title="עריכת ליד">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {editError && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{editError}</p>
          )}
          <LeadFormFields form={editForm} update={updateEdit} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingEdit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingEdit ? 'שומר...' : 'עדכון ליד'}
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
