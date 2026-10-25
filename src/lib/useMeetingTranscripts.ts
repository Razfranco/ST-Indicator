import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { MeetingTranscript } from '../types/mentorship.types'

/** טוען את תמלולי הפגישות הנגישים למשתמש הנוכחי (לפי RLS) ומחזיק מסונכרן בזמן אמת */
export function useMeetingTranscripts() {
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const channel = supabase
      .channel('meeting-transcripts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_transcripts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as MeetingTranscript
            setTranscripts((prev) => (prev.some((t) => t.id === inserted.id) ? prev : [...prev, inserted]))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MeetingTranscript
            setTranscripts((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<MeetingTranscript>).id
            setTranscripts((prev) => prev.filter((t) => t.id !== deletedId))
          }
        },
      )
      .subscribe()

    supabase
      .from('meeting_transcripts')
      .select('*')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setTranscripts(data ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { transcripts, loading, error }
}
