import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { calculatePnlFromPoints } from '../lib/calculations'
import { DIRECTIONS, RESULTS } from '../lib/constants'
import type { Direction, TradeResult } from '../types/database.types'

type PnlMode = 'auto' | 'manual'

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

function splitIsoToDateAndTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function combineDateAndTime(date: string, time: string): string | null {
  if (!date || !time) return null
  return new Date(`${date}T${time}`).toISOString()
}

interface FormState {
  date: string
  entryTime: string
  exitTime: string
  direction: Direction
  entry_price: string
  exit_price: string
  position_size: string
  pnlMode: PnlMode
  points: string
  pnl_dollars: string
  result: TradeResult
  notes: string
  screenshot_url: string
}

const initialState: FormState = {
  date: todayDateInput(),
  entryTime: nowTimeInput(),
  exitTime: '',
  direction: 'Long',
  entry_price: '',
  exit_price: '',
  position_size: '',
  pnlMode: 'auto',
  points: '',
  pnl_dollars: '',
  result: 'TP1',
  notes: '',
  screenshot_url: '',
}

export function TradeFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState<FormState>(initialState)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  useEffect(() => {
    if (!isEditing || !id) return
    let cancelled = false
    supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setError('לא ניתן היה לטעון את העסקה')
          setLoading(false)
          return
        }
        const { date, time: entryTime } = splitIsoToDateAndTime(data.entry_datetime)
        const { time: exitTime } = splitIsoToDateAndTime(data.exit_datetime)
        setForm({
          date,
          entryTime,
          exitTime,
          direction: data.direction,
          entry_price: String(data.entry_price ?? ''),
          exit_price: data.exit_price != null ? String(data.exit_price) : '',
          position_size: String(data.position_size ?? ''),
          pnlMode: data.points != null ? 'auto' : 'manual',
          points: data.points != null ? String(data.points) : '',
          pnl_dollars: data.pnl_dollars != null ? String(data.pnl_dollars) : '',
          result: data.result,
          notes: data.notes ?? '',
          screenshot_url: data.screenshot_url ?? '',
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isEditing])

  const computedPnl = useMemo(() => {
    return calculatePnlFromPoints(
      form.points ? Number(form.points) : null,
      form.position_size ? Number(form.position_size) : null,
    )
  }, [form.points, form.position_size])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const uploadScreenshot = useCallback(
    async (file: File) => {
      if (!user) return
      setUploadingScreenshot(true)
      setError(null)
      try {
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('trade-screenshots')
          .upload(path, file, { upsert: false })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('trade-screenshots').getPublicUrl(path)
        update('screenshot_url', data.publicUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'העלאת התמונה נכשלה')
      } finally {
        setUploadingScreenshot(false)
      }
    },
    [user],
  )

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            uploadScreenshot(file)
          }
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [uploadScreenshot])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const entry_datetime = combineDateAndTime(form.date, form.entryTime)
    if (!entry_datetime) {
      setError('יש למלא תאריך ושעת כניסה')
      return
    }

    const finalPnl = form.pnlMode === 'auto' ? computedPnl : Number(form.pnl_dollars)
    if (finalPnl == null || Number.isNaN(finalPnl)) {
      setError(
        form.pnlMode === 'auto'
          ? 'יש למלא כמות נקודות וכמות חוזים לחישוב הרווח/הפסד'
          : 'יש למלא רווח/הפסד',
      )
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      entry_datetime,
      exit_datetime: combineDateAndTime(form.date, form.exitTime),
      direction: form.direction,
      entry_price: form.entry_price ? Number(form.entry_price) : null,
      exit_price: form.exit_price ? Number(form.exit_price) : null,
      position_size: Number(form.position_size),
      points: form.pnlMode === 'auto' ? Number(form.points) : null,
      pnl_dollars: finalPnl,
      result: form.result,
      notes: form.notes || null,
      screenshot_url: form.screenshot_url || null,
    }

    const query = id
      ? supabase.from('trades').update(payload).eq('id', id)
      : supabase.from('trades').insert({ ...payload, user_id: user.id })

    const { error } = await query
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate('/performance')
  }

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען עסקה...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-6">
      <h2 className="text-xl font-bold">{isEditing ? 'עריכת עסקה' : 'עסקה חדשה'}</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title="תזמון">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="תאריך" required>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="שעת כניסה" required>
            <input
              type="time"
              required
              value={form.entryTime}
              onChange={(e) => update('entryTime', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="שעת יציאה">
            <input
              type="time"
              value={form.exitTime}
              onChange={(e) => update('exitTime', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="פרטי עסקה">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="כיוון" required>
            <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update('direction', d)}
                  className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                    form.direction === d
                      ? d === 'Long'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'text-zinc-400'
                  }`}
                >
                  {d === 'Long' ? 'לונג' : 'שורט'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="מחיר כניסה">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={form.entry_price}
              onChange={(e) => update('entry_price', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="מחיר יציאה">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={form.exit_price}
              onChange={(e) => update('exit_price', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="כמות חוזים" required>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              required
              value={form.position_size}
              onChange={(e) => update('position_size', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="רווח / הפסד">
        <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => update('pnlMode', 'auto')}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              form.pnlMode === 'auto' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            }`}
          >
            חישוב אוטומטי
          </button>
          <button
            type="button"
            onClick={() => update('pnlMode', 'manual')}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              form.pnlMode === 'manual' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            }`}
          >
            הזנה ידנית
          </button>
        </div>

        {form.pnlMode === 'auto' ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="כמות נקודות" required hint="חיובי לרווח, שלילי להפסד">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                value={form.points}
                onChange={(e) => update('points', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="רווח/הפסד מחושב ($)">
              <div className={`${inputClass} bg-zinc-900 text-zinc-400`} dir="ltr">
                {computedPnl != null ? computedPnl.toLocaleString('en-US') : '—'}
              </div>
            </Field>
          </div>
        ) : (
          <Field label="רווח/הפסד ($)" required>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              required
              value={form.pnl_dollars}
              onChange={(e) => update('pnl_dollars', e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
      </Section>

      <Section title="תוצאה">
        <div className="grid grid-cols-4 gap-2">
          {RESULTS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update('result', r)}
              className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                form.result === r
                  ? r === 'SL'
                    ? 'bg-red-600 text-white'
                    : r === 'BE'
                      ? 'bg-zinc-600 text-white'
                      : 'bg-emerald-600 text-white'
                  : 'border border-zinc-700 text-zinc-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </Section>

      <Section title="הערה">
        <textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="מה עבד? מה לא? תובנות לפעם הבאה..."
        />
      </Section>

      <Section title="צילום מסך">
        <Field label="צילום מסך של העסקה" hint="אפשר להדביק תמונה מהקליפבורד (Cmd/Ctrl+V) בכל מקום בעמוד, או לצרף/לצלם דרך הכפתור">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadScreenshot(file)
              e.target.value = ''
            }}
            className="text-sm text-zinc-400 file:me-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
          />
        </Field>
        {uploadingScreenshot && <p className="text-xs text-zinc-500">מעלה תמונה...</p>}
        {form.screenshot_url && !uploadingScreenshot && (
          <div className="relative w-fit">
            <img
              src={form.screenshot_url}
              alt="צילום מסך העסקה"
              className="max-h-56 rounded-lg border border-zinc-800"
            />
            <button
              type="button"
              onClick={() => update('screenshot_url', '')}
              className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-500"
              aria-label="הסרת תמונה"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </Section>

      <button
        type="submit"
        disabled={saving || uploadingScreenshot}
        className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? 'שומר...' : isEditing ? 'עדכון עסקה' : 'שמירת עסקה'}
      </button>
    </form>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-semibold text-zinc-400">{title}</h3>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}
