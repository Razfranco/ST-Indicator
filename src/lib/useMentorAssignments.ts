import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { MentorAssignment } from '../types/mentorship.types'

function sortByValidFrom(assignments: MentorAssignment[]): MentorAssignment[] {
  return [...assignments].sort((a, b) => b.valid_from.localeCompare(a.valid_from))
}

/** טוען את שיוכי המנטור-תלמיד הנגישים למשתמש הנוכחי (לפי RLS) ומחזיק מסונכרן בזמן אמת */
export function useMentorAssignments() {
  const [assignments, setAssignments] = useState<MentorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel(`mentor-assignments-changes-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mentor_assignments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as MentorAssignment
            setAssignments((prev) =>
              prev.some((a) => a.id === inserted.id) ? prev : sortByValidFrom([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MentorAssignment
            setAssignments((prev) => sortByValidFrom(prev.map((a) => (a.id === updated.id ? updated : a))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<MentorAssignment>).id
            setAssignments((prev) => prev.filter((a) => a.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('mentor_assignments')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setAssignments(sortByValidFrom(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { assignments, loading, error }
}
