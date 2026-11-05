import { archiveMeetings } from '../../lib/mentoringNotifications'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog'
import { MeetingAiPanel } from './MeetingAiPanel'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../lib/useStudents'
import { useProfiles } from '../../lib/useProfiles'
import { useMentorAssignments } from '../../lib/useMentorAssignments'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { toast } from '../../components/ui/toast'
import { FormSaveBar } from '../../components/FormSaveBar'
import type { MeetingChannel, MeetingStatus, MeetingTranscript } from '../../types/mentorship.types'

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

function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nowTimeInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function splitIsoToDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

interface FormState {
  student_id: string
  mentor_user_id: string
  date: string
  time: string
  duration_minutes: string
  channel: MeetingChannel
  status: MeetingStatus
  topic: string
  notes: string
  consent_given: boolean
}

export function MeetingFormPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(id)

  const { students } = useStudents()
  const { profiles } = useProfiles()
  const { assignments } = useMentorAssignments()

  const mentors = useMemo(() => profiles.filter((p) => p.mentor_access), [profiles])

  const assignedStudentIds = useMemo(
    () => new Set(assignments.filter((a) => a.active && a.mentor_user_id === user?.id).map((a) => a.student_id)),
    [assignments, user?.id],
  )
  const studentOptions = useMemo(
    () => (isAdmin ? students : students.filter((s) => assignedStudentIds.has(s.id))),
    [students, isAdmin, assignedStudentIds],
  )

  const [form, setForm] = useState<FormState>({
    student_id: searchParams.get('student') ?? '',
    mentor_user_id: user?.id ?? '',
    date: searchParams.get('date') ?? todayDateInput(),
    time: nowTimeInput(),
    duration_minutes: '60',
    channel: 'google_meet',
    status: 'scheduled',
    topic: '',
    notes: '',
    consent_given: false,
  })
  const [consentSaved, setConsentSaved] = useState(false)
  const [archived, setArchived] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [savingConsent, setSavingConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditing)

  const [transcript, setTranscript] = useState<MeetingTranscript | null>(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [transcriptFilename, setTranscriptFilename] = useState<string | null>(null)
  const [savingTranscript, setSavingTranscript] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [loadingTranscript, setLoadingTranscript] = useState(isEditing)

  useEffect(() => {
    if (!isEditing || !id) return
    let cancelled = false
    supabase
      .from('mentorship_meetings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setError('לא ניתן היה לטעון את הפגישה')
          setLoading(false)
          return
        }
        setConsentSaved(data.consent_given)
        setArchived(!!data.archived_at)
        const { date, time } = splitIsoToDateAndTime(data.starts_at)
        setForm({
          student_id: data.student_id,
          mentor_user_id: data.mentor_user_id,
          date,
          time,
          duration_minutes: String(data.duration_minutes),
          channel: data.channel,
          status: data.status,
          topic: data.topic ?? '',
          notes: data.notes ?? '',
          consent_given: data.consent_given,
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isEditing])

  useEffect(() => {
    if (!isEditing || !id) return
    let cancelled = false
    supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) {
          setTranscript(data)
          setTranscriptText(data.transcript_text)
          setTranscriptFilename(data.filename)
        }
        setLoadingTranscript(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isEditing])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function saveConsent(checked: boolean) {
    if (savingConsent || saving) return
    const previous = consentSaved
    update('consent_given', checked)
    setConsentError('')
    if (!isEditing || !id) return
    setSavingConsent(true)
    // Revocation blocks processing immediately; granting waits for durable save.
    setConsentSaved(false)
    try {
      const { data, error } = await supabase.from('mentorship_meetings')
        .update({ consent_given: checked }).eq('id', id).select('consent_given').single()
      if (error || !data) throw Error('לא ניתן לשמור את ההסכמה. נסה שוב.')
      setConsentSaved(data.consent_given)
      update('consent_given', data.consent_given)
    } catch {
      update('consent_given', previous)
      setConsentSaved(previous)
      setConsentError('ההסכמה לא נשמרה. בדוק את החיבור ונסה שוב.')
    } finally { setSavingConsent(false) }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
    const mentor_user_id = isAdmin ? form.mentor_user_id : user.id

    if (!form.student_id || !mentor_user_id) {
      setError('יש לבחור תלמיד ומנטור')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      student_id: form.student_id,
      mentor_user_id,
      starts_at,
      duration_minutes: Number(form.duration_minutes),
      channel: form.channel,
      status: form.status,
      topic: form.topic || null,
      notes: form.notes || null,
      consent_given: form.consent_given,
    }

    const query = id
      ? supabase.from('mentorship_meetings').update(payload).eq('id', id)
      : supabase.from('mentorship_meetings').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }

    toast.add({ title: isEditing ? 'הפגישה עודכנה' : 'הפגישה נשמרה', type: 'success' })
    navigate('/mentoring/meetings')
  }

  async function handleTranscriptFile(file: File) {
    const text = await file.text()
    setTranscriptText(text)
    setTranscriptFilename(file.name)
  }

  async function handleSaveTranscript(e: FormEvent) {
    e.preventDefault()
    if (!user || !id) return
    if (!transcriptText.trim()) {
      setTranscriptError('יש להדביק טקסט או לצרף קובץ')
      return
    }

    setSavingTranscript(true)
    setTranscriptError(null)

    const { data, error } = await supabase
      .from('meeting_transcripts')
      .upsert(
        {
          meeting_id: id,
          transcript_text: transcriptText,
          filename: transcriptFilename,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_id' },
      )
      .select('*')
      .single()

    setSavingTranscript(false)

    if (error) {
      setTranscriptError(error.message)
      toast.add({ title: 'שגיאה', description: error.message, type: 'error' })
      return
    }
    setTranscript(data)
    toast.add({ title: 'התמליל נשמר', type: 'success' })
  }

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">טוען פגישה...</p>
  }

  async function changeArchived(next: boolean) {
    if (!id) return
    setArchiving(true)
    try { await archiveMeetings([id], next); toast.add({title: next ? 'הפגישה הוסרה מהיומן. החומרים נשמרו בארכיון.' : 'הפגישה שוחזרה ליומן',type:'success'}); navigate('/mentoring/meetings') }
    catch(e) { setError((e as Error).message) }
    finally { setArchiving(false); setConfirmArchive(false) }
  }
  return (
    <div className="flex flex-col gap-5 pb-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-xl font-semibold">{isEditing ? 'עריכת פגישה' : 'פגישה חדשה'}</h2>{isEditing && <Button type="button" variant={archived ? 'outline' : 'destructive'} disabled={archiving || saving || savingConsent} onClick={() => archived ? void changeArchived(false) : setConfirmArchive(true)}>{archived ? 'שחזור ליומן' : 'מחיקת פגישה מהיומן'}</Button>}</div>
        {archived && <p role="status">הפגישה הוסרה מהיומן. ההקלטות והסיכומים זמינים בארכיון; יש לשחזר אותה לפני עדכון או עיבוד חדש.</p>}

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        <Section title="פרטי פגישה">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="תלמיד" required hint={studentOptions.length === 0 ? 'אין תלמידים משויכים אליך' : undefined}>
              <select
                required
                value={form.student_id}
                onChange={(e) => update('student_id', e.target.value)}
                className={inputClass}
              >
                <option value="">בחר/י תלמיד</option>
                {studentOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </Field>
            {isAdmin && (
              <Field label="מנטור" required>
                <select
                  required
                  value={form.mentor_user_id}
                  onChange={(e) => update('mentor_user_id', e.target.value)}
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
            )}
          </div>
        </Section>

        <Section title="תזמון">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="תאריך" required>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="שעה" required>
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="משך (דקות)" required>
              <input
                type="number"
                inputMode="numeric"
                required
                value={form.duration_minutes}
                onChange={(e) => update('duration_minutes', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="ערוץ" required>
              <select
                value={form.channel}
                onChange={(e) => update('channel', e.target.value as MeetingChannel)}
                className={inputClass}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {channelLabel[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="סטטוס והקשר">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUSES.map((s) => {
              const active = form.status === s
              const negative = s === 'cancelled' || s === 'no_show'
              return (
                <Button
                  key={s}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  onClick={() => update('status', s)}
                  className={active && negative ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
                >
                  {statusLabel[s]}
                </Button>
              )
            })}
          </div>

          <Field label="נושא">
            <input
              type="text"
              value={form.topic}
              onChange={(e) => update('topic', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="הערות">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={4}
              className={inputClass}
            />
          </Field>

          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={form.consent_given}
              disabled={archived || savingConsent || saving}
              onCheckedChange={(checked) => void saveConsent(checked === true)}
            />
            התקבלה הסכמה להקלטה/תמלול
          </Label>
          {isEditing && <p className="text-xs text-muted-foreground" role="status">{savingConsent ? 'שומר את ההסכמה…' : consentSaved ? 'ההסכמה נשמרה. אפשר להעלות הקלטה מיד.' : 'שינוי ההסכמה נשמר אוטומטית.'}</p>}
          {consentError && <p role="alert" className="text-sm text-destructive">{consentError}</p>}
        </Section>

        <FormSaveBar>
          <Button type="submit" disabled={archived || saving || savingConsent} size="lg" className="w-full">
            {saving ? 'שומר...' : isEditing ? 'עדכון פגישה' : 'שמירת פגישה'}
          </Button>
        </FormSaveBar>
      </form>

      {isEditing && (
        <form onSubmit={handleSaveTranscript}>
          <Section title="תמליל פגישה">
            <p className="text-xs text-muted-foreground">
              הדבק/י טקסט או צרף/י קובץ (TXT / SRT / VTT). ניתן להפיק סיכום מהתמליל השמור באזור ההקלטה והסיכום למטה.
            </p>

            {transcriptError && (
              <Alert variant="destructive">
                <AlertDescription className="text-destructive">{transcriptError}</AlertDescription>
              </Alert>
            )}

            {loadingTranscript ? (
              <p className="text-sm text-muted-foreground">טוען תמליל...</p>
            ) : (
              <>
                <Field label="קובץ תמליל">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="h-4 w-4 shrink-0" />
                    <input
                      type="file"
                      accept=".txt,.srt,.vtt,text/plain"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleTranscriptFile(file)
                      }}
                      className="text-sm text-muted-foreground file:me-3 file:rounded-md file:border file:border-input file:bg-muted file:px-3 file:py-1.5 file:text-foreground"
                    />
                  </div>
                </Field>

                <Field
                  label="טקסט התמליל"
                  hint={
                    transcript
                      ? `נשמר לאחרונה ${new Date(transcript.uploaded_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}${transcriptFilename ? ` · ${transcriptFilename}` : ''}`
                      : undefined
                  }
                >
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    rows={8}
                    placeholder="הדבק/י כאן את תמליל הפגישה..."
                    className={inputClass}
                  />
                </Field>

                <Button type="submit" size="sm" disabled={savingTranscript} className="self-start">
                  {savingTranscript ? 'שומר...' : transcript ? 'עדכון תמליל' : 'שמירת תמליל'}
                </Button>
              </>
            )}
          </Section>
        </form>
      )}
      {isEditing && id && <MeetingAiPanel
        meetingId={id}
        consentSaved={consentSaved && !archived}
        hasSavedTranscript={!!transcript?.transcript_text.trim()}
        onCopyTranscript={text => {
          setTranscriptText(text)
          setTranscriptFilename(null)
          toast.add({ title: 'התמליל הועתק לשדה. בדוק אותו ולחץ על שמירת תמליל.', type: 'success' })
        }}
      />}
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>מחיקת פגישה מהיומן</AlertDialogTitle><AlertDialogDescription>הפגישה תוסר מהיומן ותפסיק להפיק תזכורות. ההקלטות והסיכומים יישמרו בארכיון, וניתן יהיה לשחזר אותה.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={archiving} onClick={() => void changeArchived(true)}>מחיקה מהיומן</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
