import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Student } from '../types/mentorship.types'

function sortByName(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.display_name.localeCompare(b.display_name, 'he'))
}

/** טוען את התלמידים הנגישים למשתמש הנוכחי (לפי RLS) ומחזיק אותם מסונכרנים בזמן אמת */
export function useStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Student
            setStudents((prev) =>
              prev.some((s) => s.id === inserted.id) ? prev : sortByName([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Student
            setStudents((prev) => sortByName(prev.map((s) => (s.id === updated.id ? updated : s))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Student>).id
            setStudents((prev) => prev.filter((s) => s.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('students')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setStudents(sortByName(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { students, loading, error }
}
