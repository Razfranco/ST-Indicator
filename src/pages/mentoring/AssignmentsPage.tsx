import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card } from '../../components/ui/card'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../components/ui/table'

function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function AssignmentsPage() {
  const { students, loading: loadingStudents } = useStudents()
  const { profiles, loading: loadingProfiles } = useProfiles()
  const { assignments, loading: loadingAssignments, error: loadError } = useMentorAssignments()

  const mentors = useMemo(() => profiles.filter((p) => p.mentor_access), [profiles])
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const mentorById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const [studentId, setStudentId] = useState('')
  const [mentorUserId, setMentorUserId] = useState('')
  const [validFrom, setValidFrom] = useState(todayDateInput())
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loading = loadingStudents || loadingProfiles || loadingAssignments
  const error = loadError ?? actionError

  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => b.valid_from.localeCompare(a.valid_from)),
    [assignments],
  )

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    if (!studentId || !mentorUserId) return
    setSaving(true)
    setActionError(null)

    const { error: deactivateError } = await supabase
      .from('mentor_assignments')
      .update({ active: false, valid_to: todayDateInput() })
      .eq('student_id', studentId)
      .eq('active', true)

    if (deactivateError) {
      setSaving(false)
      setActionError(deactivateError.message)
      return
    }

    const { error } = await supabase.from('mentor_assignments').insert({
      student_id: studentId,
      mentor_user_id: mentorUserId,
      active: true,
      valid_from: validFrom,
      valid_to: null,
    })

    setSaving(false)
    if (error) {
      setActionError(error.message)
      return
    }
    setStudentId('')
    setMentorUserId('')
    setValidFrom(todayDateInput())
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-semibold">שיוכי מנטורים</h2>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Section title="שיוך חדש">
        <p className="text-xs text-muted-foreground">
          שיוך חדש לתלמיד שכבר יש לו מנטור פעיל יסיים אוטומטית את השיוך הקודם (יישאר בהיסטוריה, לא יימחק).
        </p>
        <form onSubmit={handleAssign} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="תלמיד" required>
              <select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
                <option value="">בחר/י תלמיד</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="מנטור" required>
              <select
                required
                value={mentorUserId}
                onChange={(e) => setMentorUserId(e.target.value)}
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
            <Field label="תאריך תחילה" required>
              <input
                type="date"
                required
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Button type="submit" disabled={saving} className="self-start">
            {saving ? 'משייך...' : '+ שיוך'}
          </Button>
        </form>
        {mentors.length === 0 && !loadingProfiles && (
          <p className="text-xs text-muted-foreground">
            אין עדיין אף משתמש עם גישת מנטורינג — אפשר להעניק דרך לשונית "ניהול" בפלטפורמת הביצועים.
          </p>
        )}
      </Section>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : sortedAssignments.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">אין שיוכים להצגה.</p>
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">תלמיד</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">מנטור</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">מתאריך</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">עד תאריך</th>
                <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">סטטוס</th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">
                    {studentById.get(a.student_id)?.display_name ?? 'לא ידוע'}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {mentorById.get(a.mentor_user_id)?.email ?? 'לא ידוע'}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {a.valid_from}
                  </TableCell>
                  <TableCell className="text-foreground" dir="ltr">
                    {a.valid_to ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-transparent ${a.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {a.active ? 'פעיל' : 'היסטורי'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
