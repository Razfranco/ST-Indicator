import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'

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
      <h2 className="text-xl font-bold">שיוכי מנטורים</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title="שיוך חדש">
        <p className="text-xs text-zinc-500">
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
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'משייך...' : '+ שיוך'}
          </button>
        </form>
        {mentors.length === 0 && !loadingProfiles && (
          <p className="text-xs text-zinc-500">
            אין עדיין אף משתמש עם גישת מנטורינג — אפשר להעניק דרך לשונית "ניהול" בפלטפורמת הביצועים.
          </p>
        )}
      </Section>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען שיוכים...</p>
      ) : sortedAssignments.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין שיוכים להצגה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">תלמיד</th>
                <th className="px-3 py-2 text-right font-medium">מנטור</th>
                <th className="px-3 py-2 text-right font-medium">מתאריך</th>
                <th className="px-3 py-2 text-right font-medium">עד תאריך</th>
                <th className="px-3 py-2 text-right font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sortedAssignments.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-medium text-zinc-200">
                    {studentById.get(a.student_id)?.display_name ?? 'לא ידוע'}
                  </td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {mentorById.get(a.mentor_user_id)?.email ?? 'לא ידוע'}
                  </td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {a.valid_from}
                  </td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {a.valid_to ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        a.active ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {a.active ? 'פעיל' : 'היסטורי'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
