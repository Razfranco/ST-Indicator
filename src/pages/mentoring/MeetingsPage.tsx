import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useMentorshipMeetings } from '../../lib/useMentorshipMeetings'
import { useMeetingTranscripts } from '../../lib/useMeetingTranscripts'
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

const MONTH_LABELS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
]
const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dateKeyOf(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

type SortField = 'starts_at' | 'status'
type View = 'calendar' | 'list'

export function MeetingsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { meetings, loading, error: loadError } = useMentorshipMeetings()
  const { transcripts } = useMeetingTranscripts()
  const { students } = useStudents()
  const { profiles } = useProfiles()

  const [view, setView] = useState<View>('calendar')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('')
  const [channelFilter, setChannelFilter] = useState<MeetingChannel | ''>('')
  const [studentFilter, setStudentFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [sortField, setSortField] = useState<SortField | null>('starts_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const error = loadError ?? actionError

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const mentorById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const transcriptMeetingIds = useMemo(() => new Set(transcripts.map((t) => t.meeting_id)), [transcripts])

  function missingTranscript(m: { id: string; status: MeetingStatus }) {
    return m.status === 'completed' && !transcriptMeetingIds.has(m.id)
  }

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

  const calendar = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const leadingBlanks = new Date(calYear, calMonth, 1).getDay()

    const byDay = new Map<string, typeof filtered>()
    for (const m of filtered) {
      const d = new Date(m.starts_at)
      if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) continue
      const key = dateKeyOf(m.starts_at)
      const list = byDay.get(key) ?? []
      list.push(m)
      byDay.set(key, list)
    }

    const days = []
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`
      const dayMeetings = (byDay.get(key) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      days.push({ key, day, meetings: dayMeetings })
    }

    return { days, leadingBlanks, monthLabel: `${MONTH_LABELS[calMonth]} ${calYear}` }
  }, [filtered, calYear, calMonth])

  function goMonth(delta: number) {
    const total = calYear * 12 + calMonth + delta
    setCalYear(Math.floor(total / 12))
    setCalMonth(((total % 12) + 12) % 12)
  }

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

      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={`flex-1 rounded-md py-1.5 font-semibold transition ${
            view === 'calendar' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
          }`}
        >
          לוח שנה
        </button>
        <button
          type="button"
          onClick={() => setView('list')}
          className={`flex-1 rounded-md py-1.5 font-semibold transition ${
            view === 'list' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
          }`}
        >
          רשימה
        </button>
      </div>

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
        {view === 'list' && (
          <>
            <FilterField label="מתאריך">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={filterInputClass}
              />
            </FilterField>
            <FilterField label="עד תאריך">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInputClass} />
            </FilterField>
          </>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען פגישות...</p>
      ) : view === 'calendar' ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
              >
                ‹ קודם
              </button>
              <span className="min-w-[100px] text-center font-medium text-zinc-200">{calendar.monthLabel}</span>
              <button
                type="button"
                onClick={() => goMonth(1)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
              >
                הבא ›
              </button>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> פגישה שהתקיימה בלי תמליל מצורף
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
            {Array.from({ length: calendar.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {calendar.days.map((cell) => (
              <div
                key={cell.key}
                className="flex min-h-[76px] flex-col gap-1 rounded-md border border-zinc-800/60 p-1 text-right sm:min-h-[100px]"
              >
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] text-zinc-500">{cell.day}</span>
                  <Link
                    to={`/mentoring/meetings/new?date=${cell.key}`}
                    className="text-xs leading-none text-zinc-600 hover:text-emerald-400"
                    title="פגישה חדשה"
                  >
                    +
                  </Link>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {cell.meetings.slice(0, 3).map((m) => (
                    <Link
                      key={m.id}
                      to={`/mentoring/meetings/${m.id}/edit`}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium ${statusClass[m.status]}`}
                      title={`${formatTime(m.starts_at)} · ${studentById.get(m.student_id)?.display_name ?? ''}`}
                    >
                      {missingTranscript(m) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                      <span dir="ltr" className="shrink-0">
                        {formatTime(m.starts_at)}
                      </span>
                      <span className="truncate">{studentById.get(m.student_id)?.display_name ?? '—'}</span>
                    </Link>
                  ))}
                  {cell.meetings.length > 3 && (
                    <span className="px-1 text-[10px] text-zinc-500">+{cell.meetings.length - 3} עוד</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין פגישות להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                    {missingTranscript(m) && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
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
                      <span className="flex items-center gap-1.5">
                        {missingTranscript(m) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                        {studentById.get(m.student_id)?.display_name ?? 'תלמיד לא ידוע'}
                      </span>
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
