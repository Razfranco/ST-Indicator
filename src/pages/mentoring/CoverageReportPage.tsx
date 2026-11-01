import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, UserX, CalendarX, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useCustomers } from '../../lib/useCustomers'
import { useStudents } from '../../lib/useStudents'
import { useMentorshipMeetings } from '../../lib/useMentorshipMeetings'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { useProfiles } from '../../lib/useProfiles'
import { getEffectiveStatus, isLiveTrackPlan } from '../../lib/businessStats'
import { StatTile } from '../../components/StatTile'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/EmptyState'
import { toast } from '../../components/ui/toast'
import type { Customer } from '../../types/business.types'

type Severity = 'missing_student' | 'missing_meeting' | 'ok'

const severityRank: Record<Severity, number> = { missing_student: 0, missing_meeting: 1, ok: 2 }

interface Row {
  id: string
  name: string
  planBadge: string | null
  mentorEmail: string | null
  meeting: ReturnType<typeof useMentorshipMeetings>['meetings'][number] | null
  severity: Severity
  studentId: string | null
  customer: Customer | null
}

/** פגישה מתוזמנת הכי קרובה בשבוע הקרוב, לכל תלמיד */
function buildNextMeetingByStudentId(meetings: ReturnType<typeof useMentorshipMeetings>['meetings']) {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const map = new Map<string, (typeof meetings)[number]>()
  for (const m of meetings) {
    if (m.status !== 'scheduled') continue
    const start = new Date(m.starts_at)
    if (start < now || start > weekFromNow) continue
    const existing = map.get(m.student_id)
    if (!existing || start < new Date(existing.starts_at)) {
      map.set(m.student_id, m)
    }
  }
  return map
}

export function CoverageReportPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const { customers, loading: loadingCustomers, error: customersError } = useCustomers()
  const { students, loading: loadingStudents } = useStudents()
  const { meetings, loading: loadingMeetings } = useMentorshipMeetings()
  const { assignments } = useMentorAssignments()
  const { profiles } = useProfiles()

  const loading = isAdmin
    ? loadingCustomers || loadingStudents || loadingMeetings
    : loadingStudents || loadingMeetings

  const [creatingStudentFor, setCreatingStudentFor] = useState<string | null>(null)

  async function handleQuickCreateStudent(c: Customer) {
    setCreatingStudentFor(c.id)
    const { error } = await supabase.from('students').insert({
      display_name: c.full_name,
      phone: c.phone || null,
      status: 'active',
      notes: null,
      customer_id: c.id,
    })
    setCreatingStudentFor(null)
    if (error) {
      toast.add({ title: 'שגיאה ביצירת תלמיד', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: `תלמיד נוצר ומקושר ל-${c.full_name}`, type: 'success' })
  }

  const mentorEmailByStudentId = useMemo(() => {
    const profileById = new Map(profiles.map((p) => [p.id, p]))
    const map = new Map<string, string>()
    for (const a of assignments) {
      if (!a.active) continue
      const mentor = profileById.get(a.mentor_user_id)
      if (mentor) map.set(a.student_id, mentor.email)
    }
    return map
  }, [assignments, profiles])

  /** אדמין: כל הלקוחות הפעילים במסלול גולד/פלטינום, כולל מי שעדיין לא קושר לתלמיד בכלל */
  const adminRows = useMemo((): Row[] => {
    const nextMeetingByStudentId = buildNextMeetingByStudentId(meetings)
    return customers
      .filter((c) => isLiveTrackPlan(c.plan) && getEffectiveStatus(c) === 'active')
      .map((c): Row => {
        const student = students.find((s) => s.customer_id === c.id) ?? null
        const meeting = student ? nextMeetingByStudentId.get(student.id) ?? null : null
        const severity: Severity = !student ? 'missing_student' : !meeting ? 'missing_meeting' : 'ok'
        return {
          id: c.id,
          name: c.full_name,
          planBadge: c.plan,
          mentorEmail: student ? mentorEmailByStudentId.get(student.id) ?? null : null,
          meeting,
          severity,
          studentId: student?.id ?? null,
          customer: severity === 'missing_student' ? c : null,
        }
      })
  }, [customers, students, meetings, mentorEmailByStudentId])

  /** מנטור רגיל: רק התלמידים המשויכים אליו (RLS כבר מגביל students/meetings לשלו בלבד) */
  const mentorRows = useMemo((): Row[] => {
    if (!profile) return []
    const nextMeetingByStudentId = buildNextMeetingByStudentId(meetings)
    const studentById = new Map(students.map((s) => [s.id, s]))
    return assignments
      .filter((a) => a.active && a.mentor_user_id === profile.id)
      .map((a) => studentById.get(a.student_id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s): Row => {
        const meeting = nextMeetingByStudentId.get(s.id) ?? null
        return {
          id: s.id,
          name: s.display_name,
          planBadge: null,
          mentorEmail: null,
          meeting,
          severity: meeting ? 'ok' : 'missing_meeting',
          studentId: s.id,
          customer: null,
        }
      })
  }, [assignments, students, meetings, profile])

  const { rows, missingCount } = useMemo(() => {
    const built = (isAdmin ? adminRows : mentorRows).sort((a, b) => {
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity]
      }
      return a.name.localeCompare(b.name, 'he')
    })
    return { rows: built, missingCount: built.filter((r) => r.severity !== 'ok').length }
  }, [isAdmin, adminRows, mentorRows])

  function formatMeetingTime(iso: string) {
    return new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (isAdmin && !profile?.business_access) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-destructive">
          דוח זה קורא את רשימת הלקוחות מהמודול העסקי — דרושה לך גישה עסקית (business_access) כדי לצפות בו.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-xl font-semibold">בקרת ליווי</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? 'כל הלקוחות הפעילים במסלול גולד/פלטינום, עם סימון למי שאין לו פגישת ליווי משובצת לשבוע הקרוב.'
            : 'התלמידים המשויכים אליך, עם סימון למי שאין לו פגישה משובצת לשבוע הקרוב.'}
        </p>
      </div>

      {isAdmin && customersError && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{customersError}</AlertDescription>
        </Alert>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label={isAdmin ? 'סה&quot;כ במסלולי ליווי' : 'סה&quot;כ תלמידים'} value={String(rows.length)} />
          <StatTile
            label="דורשים טיפול"
            value={String(missingCount)}
            tone={missingCount > 0 ? 'negative' : 'positive'}
          />
          <StatTile label="מכוסים" value={String(rows.length - missingCount)} tone="positive" />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={isAdmin ? 'אין לקוחות במסלול גולד/פלטינום' : 'אין לך תלמידים משויכים כרגע'}
          description={
            isAdmin
              ? 'כשיהיו לקוחות במסלולים האלו, הם יופיעו כאן עם סטטוס הכיסוי שלהם.'
              : 'כשיוקצו לך תלמידים, הם יופיעו כאן עם סטטוס הכיסוי שלהם.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ id, name, planBadge, meeting, mentorEmail, severity, studentId, customer }) => (
            <Card
              key={id}
              className={`flex-row flex-wrap items-center justify-between gap-3 p-3 shadow-sm ${
                severity !== 'ok' ? 'border-e-2 border-e-destructive/60' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{name}</span>
                  {planBadge && (
                    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                      {planBadge}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {mentorEmail && <span dir="ltr">מנטור: {mentorEmail}</span>}
                  {meeting && <span dir="ltr">פגישה: {formatMeetingTime(meeting.starts_at)}</span>}
                </div>
              </div>

              {severity === 'missing_student' && customer && (
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                    <UserX className="h-3 w-3" /> לא קושר למנטורינג
                  </Badge>
                  <Button
                    size="sm"
                    disabled={creatingStudentFor === customer.id}
                    onClick={() => handleQuickCreateStudent(customer)}
                  >
                    {creatingStudentFor === customer.id ? 'יוצר...' : 'יצירת תלמיד'}
                  </Button>
                </div>
              )}
              {severity === 'missing_meeting' && (
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                    <CalendarX className="h-3 w-3" /> אין פגישה לשבוע הקרוב
                  </Badge>
                  <Button size="sm" variant="outline" render={<Link to={`/mentoring/meetings/new?student=${studentId}`} />}>
                    שיבוץ פגישה
                  </Button>
                </div>
              )}
              {severity === 'ok' && (
                <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3 w-3" /> מכוסה
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
