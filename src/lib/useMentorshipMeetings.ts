import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { MentorshipMeeting } from '../types/mentorship.types'

function sortByStartsAt(meetings: MentorshipMeeting[]): MentorshipMeeting[] {
  return [...meetings].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
}

/** טוען את פגישות הליווי הנגישות למשתמש הנוכחי (לפי RLS) ומחזיק מסונכרן בזמן אמת */
export function useMentorshipMeetings() {
  const [meetings, setMeetings] = useState<MentorshipMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('mentorship-meetings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mentorship_meetings' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as MentorshipMeeting
            setMeetings((prev) =>
              prev.some((m) => m.id === inserted.id) ? prev : sortByStartsAt([...prev, inserted]),
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MentorshipMeeting
            setMeetings((prev) => sortByStartsAt(prev.map((m) => (m.id === updated.id ? updated : m))))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<MentorshipMeeting>).id
            setMeetings((prev) => prev.filter((m) => m.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('mentorship_meetings')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setMeetings(sortByStartsAt(data ?? []))
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { meetings, loading, error }
}
