import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, UserX, CalendarX, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCustomers } from '../../lib/useCustomers'
import { useStudents } from '../../lib/useStudents'
import { useMentorshipMeetings } from '../../lib/useMentorshipMeetings'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { useProfiles } from '../../lib/useProfiles'
import { getEffectiveStatus } from '../../lib/businessStats'
import { StatTile } from '../../components/StatTile'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/EmptyState'

/** מסלולי "ליווי" שדורשים מעקב פגישות — גולד/פלטינום בלבד, לא סילבר */
function isLiveTrackPlan(plan: string): boolean {
  const p = plan.toLowerCase()
  return p.includes('גולד') || p.includes('gold') || p.includes('פלטינום') || p.includes('platinum')
}

type Severity = 'missing_student' | 'missing_meeting' | 'ok'

const severityRank: Record<Severity, number> = { missing_student: 0, missing_meeting: 1, ok: 2 }

export function CoverageReportPage() {
  const { profile } = useAuth()
  const { customers, loading: loadingCustomers, error: customersError } = useCustomers()
  const { students, loading: loadingStudents } = useStudents()
  const { meetings, loading: loadingMeetings } = useMentorshipMeetings()
  const { assignments } = useMentorAssignments()
  const { profiles } = useProfiles()

  const loading = loadingCustomers || loadingStudents || loadingMeetings

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

  const { rows, missingCount } = useMemo(() => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const nextMeetingByStudentId = new Map<string, (typeof meetings)[number]>()
    for (const m of meetings) {
      if (m.status !== 'scheduled') continue
      const start = new Date(m.starts_at)
      if (start < now || start > weekFromNow) continue
      const existing = nextMeetingByStudentId.get(m.student_id)
      if (!existing || start < new Date(existing.starts_at)) {
        nextMeetingByStudentId.set(m.student_id, m)
      }
    }

    const built = customers
      .filter((c) => isLiveTrackPlan(c.plan) && getEffectiveStatus(c) === 'active')
      .map((c) => {
        const student = students.find((s) => s.customer_id === c.id) ?? null
        const meeting = student ? nextMeetingByStudentId.get(student.id) ?? null : null
        const severity: Severity = !student ? 'missing_student' : !meeting ? 'missing_meeting' : 'ok'
        const mentorEmail = student ? mentorEmailByStudentId.get(student.id) ?? null : null
        return { customer: c, student, meeting, mentorEmail, severity }
      })
      .sort((a, b) => {
        if (severityRank[a.severity] !== severityRank[b.severity]) {
          return severityRank[a.severity] - severityRank[b.severity]
        }
        return a.customer.full_name.localeCompare(b.customer.full_name, 'he')
      })

    return { rows: built, missingCount: built.filter((r) => r.severity !== 'ok').length }
  }, [customers, students, meetings, mentorEmailByStudentId])

  function formatMeetingTime(iso: string) {
    return new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (!profile?.business_access) {
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
          כל הלקוחות הפעילים במסלול גולד/פלטינום, עם סימון למי שאין לו פגישת ליווי משובצת לשבוע הקרוב.
        </p>
      </div>

      {customersError && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{customersError}</AlertDescription>
        </Alert>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="סה&quot;כ במסלולי ליווי" value={String(rows.length)} />
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
          title="אין לקוחות במסלול גולד/פלטינום"
          description="כשיהיו לקוחות במסלולים האלו, הם יופיעו כאן עם סטטוס הכיסוי שלהם."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ customer: c, student, meeting, mentorEmail, severity }) => (
            <Card
              key={c.id}
              className={`flex-row flex-wrap items-center justify-between gap-3 p-3 shadow-sm ${
                severity !== 'ok' ? 'border-e-2 border-e-destructive/60' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{c.full_name}</span>
                  <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                    {c.plan}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {mentorEmail && <span dir="ltr">מנטור: {mentorEmail}</span>}
                  {meeting && <span dir="ltr">פגישה: {formatMeetingTime(meeting.starts_at)}</span>}
                </div>
              </div>

              {severity === 'missing_student' && (
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                    <UserX className="h-3 w-3" /> לא קושר למנטורינג
                  </Badge>
                  <Button size="sm" variant="outline" render={<Link to="/mentoring/students" />}>
                    לרשימת תלמידים
                  </Button>
                </div>
              )}
              {severity === 'missing_meeting' && (
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                    <CalendarX className="h-3 w-3" /> אין פגישה לשבוע הקרוב
                  </Badge>
                  <Button size="sm" variant="outline" render={<Link to={`/mentoring/meetings/new?student=${student?.id}`} />}>
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
