import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import type { MeetingChannel, MeetingStatus } from '../../types/mentorship.types'

const CHANNELS: MeetingChannel[] = ['whatsapp', 'google_meet', 'other']
const channelLabel: Record<MeetingChannel, string> = {
  whatsapp: 'WhatsApp',
  google_meet: 'Google Meet',
  other: 'אחר',
}

const STATUSES: MeetingStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']
const statusLabel: Record<MeetingStatus, string> = {
  scheduled: 'מתוכננת',
  completed: 'התקיימה',
  cancelled: 'בוטלה',
  no_show: 'לא הגיע',
}

function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nowTimeInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function splitIsoToDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

interface FormState {
  student_id: string
  mentor_user_id: string
  date: string
  time: string
  duration_minutes: string
  channel: MeetingChannel
  status: MeetingStatus
  topic: string
  notes: string
  consent_given: boolean
}

export function MeetingFormPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const { students } = useStudents()
  const { profiles } = useProfiles()
  const { assignments } = useMentorAssignments()

  const mentors = useMemo(() => profiles.filter((p) => p.mentor_access), [profiles])

  const assignedStudentIds = useMemo(
    () => new Set(assignments.filter((a) => a.active && a.mentor_user_id === user?.id).map((a) => a.student_id)),
    [assignments, user?.id],
  )
  const studentOptions = useMemo(
    () => (isAdmin ? students : students.filter((s) => assignedStudentIds.has(s.id))),
    [students, isAdmin, assignedStudentIds],
  )

  const [form, setForm] = useState<FormState>({
    student_id: '',
    mentor_user_id: user?.id ?? '',
    date: todayDateInput(),
    time: nowTimeInput(),
    duration_minutes: '60',
    channel: 'google_meet',
    status: 'scheduled',
    topic: '',
    notes: '',
    consent_given: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditing)

  useEffect(() => {
    if (!isEditing || !id) return
    let cancelled = false
    supabase
      .from('mentorship_meetings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setError('לא ניתן היה לטעון את הפגישה')
          setLoading(false)
          return
        }
        const { date, time } = splitIsoToDateAndTime(data.starts_at)
        setForm({
          student_id: data.student_id,
          mentor_user_id: data.mentor_user_id,
          date,
          time,
          duration_minutes: String(data.duration_minutes),
          channel: data.channel,
          status: data.status,
          topic: data.topic ?? '',
          notes: data.notes ?? '',
          consent_given: data.consent_given,
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isEditing])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
    const mentor_user_id = isAdmin ? form.mentor_user_id : user.id

    if (!form.student_id || !mentor_user_id) {
      setError('יש לבחור תלמיד ומנטור')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      student_id: form.student_id,
      mentor_user_id,
      starts_at,
      duration_minutes: Number(form.duration_minutes),
      channel: form.channel,
      status: form.status,
      topic: form.topic || null,
      notes: form.notes || null,
      consent_given: form.consent_given,
    }

    const query = id
      ? supabase.from('mentorship_meetings').update(payload).eq('id', id)
      : supabase.from('mentorship_meetings').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate('/mentoring/meetings')
  }

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען פגישה...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-6">
      <h2 className="text-xl font-bold">{isEditing ? 'עריכת פגישה' : 'פגישה חדשה'}</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title="פרטי פגישה">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="תלמיד" required hint={studentOptions.length === 0 ? 'אין תלמידים משויכים אליך' : undefined}>
            <select
              required
              value={form.student_id}
              onChange={(e) => update('student_id', e.target.value)}
              className={inputClass}
            >
              <option value="">בחר/י תלמיד</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </Field>
          {isAdmin && (
            <Field label="מנטור" required>
              <select
                required
                value={form.mentor_user_id}
                onChange={(e) => update('mentor_user_id', e.target.value)}
                className={inputClass}
              >
                <option value="">בחר/י מנטור</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Section>

      <Section title="תזמון">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="תאריך" required>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="שעה" required>
            <input
              type="time"
              required
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="משך (דקות)" required>
            <input
              type="number"
              inputMode="numeric"
              required
              value={form.duration_minutes}
              onChange={(e) => update('duration_minutes', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="ערוץ" required>
            <select value={form.channel} onChange={(e) => update('channel', e.target.value as MeetingChannel)} className={inputClass}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {channelLabel[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="סטטוס והקשר">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update('status', s)}
              className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                form.status === s
                  ? s === 'cancelled' || s === 'no_show'
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-600 text-white'
                  : 'border border-zinc-700 text-zinc-400'
              }`}
            >
              {statusLabel[s]}
            </button>
          ))}
        </div>

        <Field label="נושא">
          <input type="text" value={form.topic} onChange={(e) => update('topic', e.target.value)} className={inputClass} />
        </Field>

        <Field label="הערות">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={form.consent_given}
            onChange={(e) => update('consent_given', e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          התקבלה הסכמה להקלטה/תמלול
        </label>
      </Section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? 'שומר...' : isEditing ? 'עדכון פגישה' : 'שמירת פגישה'}
      </button>
    </form>
  )
}
