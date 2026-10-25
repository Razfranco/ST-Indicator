import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useMentorshipMeetings } from '../../lib/useMentorshipMeetings'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { FilterField, filterInputClass, SortHeader, CardField } from '../../components/BusinessFormControls'
import type { SortDir } from '../../components/BusinessFormControls'
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
const statusClass: Record<MeetingStatus, string> = {
  scheduled: 'bg-sky-950 text-sky-400',
  completed: 'bg-emerald-950 text-emerald-400',
  cancelled: 'bg-red-950 text-red-400',
  no_show: 'bg-amber-950 text-amber-400',
}

type SortField = 'starts_at' | 'status'

export function MeetingsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { meetings, loading, error: loadError } = useMentorshipMeetings()
  const { students } = useStudents()
  const { profiles } = useProfiles()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('')
  const [channelFilter, setChannelFilter] = useState<MeetingChannel | ''>('')
  const [studentFilter, setStudentFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [sortField, setSortField] = useState<SortField | null>('starts_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const error = loadError ?? actionError

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const mentorById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const studentOptions = useMemo(
    () =>
      Array.from(new Set(meetings.map((m) => m.student_id)))
        .map((id) => studentById.get(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .sort((a, b) => a.display_name.localeCompare(b.display_name, 'he')),
    [meetings, studentById],
  )

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false
      if (channelFilter && m.channel !== channelFilter) return false
      if (studentFilter && m.student_id !== studentFilter) return false
      if (fromDate && m.starts_at < fromDate) return false
      if (toDate && m.starts_at > toDate + 'T23:59:59') return false
      return true
    })
  }, [meetings, statusFilter, channelFilter, studentFilter, fromDate, toDate])

  const sorted = useMemo(() => {
    if (!sortField) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      const cmp = sortField === 'starts_at' ? a.starts_at.localeCompare(b.starts_at) : a.status.localeCompare(b.status)
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

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הפגישה? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('mentorship_meetings').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  function formatStartsAt(iso: string) {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">פגישות ({sorted.length})</h2>
        <Link
          to="/mentoring/meetings/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + פגישה חדשה
        </Link>
      </div>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-5">
        <FilterField label="תלמיד">
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className={filterInputClass}>
            <option value="">הכל</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="סטטוס">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MeetingStatus | '')}
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
        <FilterField label="ערוץ">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as MeetingChannel | '')}
            className={filterInputClass}
          >
            <option value="">הכל</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabel[c]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="מתאריך">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInputClass} />
        </FilterField>
        <FilterField label="עד תאריך">
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInputClass} />
        </FilterField>
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען פגישות...</p>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין פגישות להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-200">
                    {studentById.get(m.student_id)?.display_name ?? 'תלמיד לא ידוע'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[m.status]}`}>
                    {statusLabel[m.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <CardField label="תאריך ושעה">
                    <span dir="ltr">{formatStartsAt(m.starts_at)}</span>
                  </CardField>
                  <CardField label="ערוץ">{channelLabel[m.channel]}</CardField>
                  {isAdmin && <CardField label="מנטור">{mentorById.get(m.mentor_user_id)?.email ?? '—'}</CardField>}
                  <CardField label="משך">{m.duration_minutes} דק'</CardField>
                </div>
                <div className="flex gap-3 border-t border-zinc-800 pt-2">
                  <Link to={`/mentoring/meetings/${m.id}/edit`} className="text-xs text-zinc-400 hover:text-emerald-400">
                    עריכה
                  </Link>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <SortHeader label="תאריך ושעה" field="starts_at" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">תלמיד</th>
                  {isAdmin && <th className="px-3 py-2 text-right font-medium">מנטור</th>}
                  <th className="px-3 py-2 text-right font-medium">ערוץ</th>
                  <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-right font-medium">נושא</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-900/60">
                    <td className="px-3 py-2 text-zinc-300" dir="ltr">
                      {formatStartsAt(m.starts_at)}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-200">
                      {studentById.get(m.student_id)?.display_name ?? 'תלמיד לא ידוע'}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-zinc-300" dir="ltr">
                        {mentorById.get(m.mentor_user_id)?.email ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-zinc-300">{channelLabel[m.channel]}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass[m.status]}`}>
                        {statusLabel[m.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{m.topic ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-left">
                      <Link
                        to={`/mentoring/meetings/${m.id}/edit`}
                        className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                      >
                        עריכה
                      </Link>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
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
    </div>
  )
}
