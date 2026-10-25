import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar as CalendarIcon, List as ListIcon, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useMentorshipMeetings } from '../../lib/useMentorshipMeetings'
import { useMeetingTranscripts } from '../../lib/useMeetingTranscripts'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { FilterField, filterInputClass, SortHeader, CardField } from '../../components/BusinessFormControls'
import type { SortDir } from '../../components/BusinessFormControls'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../components/ui/table'
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
  scheduled: 'bg-sky-100 text-sky-800',
  completed: 'bg-primary/10 text-primary',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show: 'bg-amber-100 text-amber-800',
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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

  async function confirmDelete() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setDeletingId(id)
    const { error } = await supabase.from('mentorship_meetings').delete().eq('id', id)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (error) setActionError(error.message)
  }

  function formatStartsAt(iso: string) {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">פגישות ({sorted.length})</h2>
        <Button render={<Link to="/mentoring/meetings/new" />}>
          <Plus className="h-4 w-4" /> פגישה חדשה
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList className="w-full">
          <TabsTrigger value="calendar" className="flex-1 gap-1.5">
            <CalendarIcon className="h-4 w-4" /> לוח שנה
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1 gap-1.5">
            <ListIcon className="h-4 w-4" /> רשימה
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="grid grid-cols-2 gap-3 p-3 shadow-sm sm:grid-cols-5">
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
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : view === 'calendar' ? (
        <Card className="p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={() => goMonth(-1)}>
                ‹ קודם
              </Button>
              <span className="min-w-[100px] text-center font-medium text-foreground">{calendar.monthLabel}</span>
              <Button variant="outline" size="sm" onClick={() => goMonth(1)}>
                הבא ›
              </Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> פגישה שהתקיימה בלי תמליל מצורף
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
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
                className="flex min-h-[76px] flex-col gap-1 rounded-md border border-border p-1 text-right sm:min-h-[100px]"
              >
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] text-muted-foreground">{cell.day}</span>
                  <Link
                    to={`/mentoring/meetings/new?date=${cell.key}`}
                    className="text-xs leading-none text-muted-foreground hover:text-primary"
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
                    <span className="px-1 text-[10px] text-muted-foreground">+{cell.meetings.length - 3} עוד</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">אין פגישות להצגה.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((m) => (
              <Card key={m.id} className="gap-2 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {missingTranscript(m) && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                    {studentById.get(m.student_id)?.display_name ?? 'תלמיד לא ידוע'}
                  </span>
                  <Badge variant="outline" className={`border-transparent ${statusClass[m.status]}`}>
                    {statusLabel[m.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <CardField label="תאריך ושעה">
                    <span dir="ltr">{formatStartsAt(m.starts_at)}</span>
                  </CardField>
                  <CardField label="ערוץ">{channelLabel[m.channel]}</CardField>
                  {isAdmin && <CardField label="מנטור">{mentorById.get(m.mentor_user_id)?.email ?? '—'}</CardField>}
                  <CardField label="משך">{m.duration_minutes} דק'</CardField>
                </div>
                <div className="flex gap-3 border-t border-border pt-2">
                  <Button variant="link" size="sm" className="h-auto p-0" render={<Link to={`/mentoring/meetings/${m.id}/edit`} />}>
                    עריכה
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-destructive"
                    onClick={() => setConfirmDeleteId(m.id)}
                    disabled={deletingId === m.id}
                  >
                    מחיקה
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden sm:block">
            <Card className="overflow-hidden p-0 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="תאריך ושעה" field="starts_at" current={sortField} dir={sortDir} onClick={toggleSort} />
                    <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">תלמיד</th>
                    {isAdmin && (
                      <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">מנטור</th>
                    )}
                    <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">ערוץ</th>
                    <SortHeader label="סטטוס" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
                    <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">נושא</th>
                    <th className="h-10 px-2"></th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-foreground" dir="ltr">
                        {formatStartsAt(m.starts_at)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {missingTranscript(m) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                          {studentById.get(m.student_id)?.display_name ?? 'תלמיד לא ידוע'}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-foreground" dir="ltr">
                          {mentorById.get(m.mentor_user_id)?.email ?? '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-foreground">{channelLabel[m.channel]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${statusClass[m.status]}`}>
                          {statusLabel[m.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.topic ?? '—'}</TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            render={<Link to={`/mentoring/meetings/${m.id}/edit`} />}
                          >
                            עריכה
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-destructive"
                            onClick={() => setConfirmDeleteId(m.id)}
                            disabled={deletingId === m.id}
                          >
                            מחיקה
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(next: boolean) => !next && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פגישה</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה. למחוק את הפגישה?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
