import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../lib/useStudents'
import { Modal } from '../../components/Modal'
import { Field, inputClass, FilterField, filterInputClass } from '../../components/BusinessFormControls'
import type { Student, StudentStatus } from '../../types/mentorship.types'

const STATUSES: StudentStatus[] = ['active', 'paused', 'ended']
const statusLabel: Record<StudentStatus, string> = { active: 'פעיל', paused: 'מושהה', ended: 'הסתיים' }
const statusClass: Record<StudentStatus, string> = {
  active: 'bg-emerald-950 text-emerald-400',
  paused: 'bg-amber-950 text-amber-400',
  ended: 'bg-zinc-800 text-zinc-400',
}

interface FormState {
  display_name: string
  phone: string
  status: StudentStatus
  notes: string
}

function emptyForm(): FormState {
  return { display_name: '', phone: '', status: 'active', notes: '' }
}

function toForm(s: Student): FormState {
  return { display_name: s.display_name, phone: s.phone ?? '', status: s.status, notes: s.notes ?? '' }
}

export function StudentsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { students, loading, error: loadError } = useStudents()

  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')

  const [editing, setEditing] = useState<Student | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
    }

    const query = editing
      ? supabase.from('students').update(payload).eq('id', editing.id)
      : supabase.from('students').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    closeModal()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את התלמיד? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('students').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">תלמידים ({filtered.length})</h2>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + תלמיד חדש
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-3">
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
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען תלמידים...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין תלמידים להצגה.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{s.display_name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[s.status]}`}>
                    {statusLabel[s.status]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                  {s.phone && <span dir="ltr">{s.phone}</span>}
                  {s.notes && <span>{s.notes}</span>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-3">
                  <button onClick={() => openEdit(s)} className="text-xs text-zinc-400 hover:text-emerald-400">
                    עריכה
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                  >
                    מחיקה
                  </button>
                </div>
              )}
            </div>
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
            <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update('status', s)}
                  className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                    form.status === s ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  {statusLabel[s]}
                </button>
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'שומר...' : editing ? 'עדכון' : 'יצירה'}
            </button>
            <button
              type="button"
              onClick={closeModal}
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
