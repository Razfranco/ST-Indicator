import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLeads } from '../../lib/useLeads'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import type { Lead } from '../../types/business.types'

interface FormState {
  full_name: string
  phone: string
  source: string
  note: string
  follow_up: string
}

const emptyForm: FormState = { full_name: '', phone: '', source: '', note: '', follow_up: '' }

function toForm(lead: Lead): FormState {
  return {
    full_name: lead.full_name,
    phone: lead.phone,
    source: lead.source,
    note: lead.note ?? '',
    follow_up: lead.follow_up ?? '',
  }
}

export function LeadsPage() {
  const { leads, loading, error: loadError } = useLeads()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const error = loadError ?? actionError

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function startEdit(lead: Lead) {
    setEditingId(lead.id)
    setForm(toForm(lead))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setActionError(null)

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      note: form.note || null,
      follow_up: form.follow_up || null,
    }

    const query = editingId
      ? supabase.from('leads').update(payload).eq('id', editingId)
      : supabase.from('leads').insert(payload)

    const { error } = await query
    setSaving(false)

    if (error) {
      setActionError(error.message)
      return
    }
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הליד? פעולה זו אינה הפיכה.')) return
    setDeletingId(id)
    const { error } = await supabase.from('leads').delete().eq('id', id)
    setDeletingId(null)
    if (error) setActionError(error.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">לידים ({leads.length})</h2>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

      <Section title={editingId ? 'עריכת ליד' : 'ליד חדש'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="שם מלא" required>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="טלפון" required>
              <input
                type="tel"
                dir="ltr"
                required
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="מקור" required hint="לדוגמה: אינסטגרם, המלצה">
              <input
                type="text"
                required
                value={form.source}
                onChange={(e) => update('source', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="פולו-אפ">
              <input
                type="text"
                value={form.follow_up}
                onChange={(e) => update('follow_up', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="הערה">
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'שומר...' : editingId ? 'עדכון ליד' : '+ הוספת ליד'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                ביטול
              </button>
            )}
          </div>
        </form>
      </Section>

      {loading ? (
        <p className="py-10 text-center text-zinc-500">טוען לידים...</p>
      ) : leads.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">אין לידים להצגה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">שם מלא</th>
                <th className="px-3 py-2 text-right font-medium">טלפון</th>
                <th className="px-3 py-2 text-right font-medium">מקור</th>
                <th className="px-3 py-2 text-right font-medium">פולו-אפ</th>
                <th className="px-3 py-2 text-right font-medium">הערה</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-medium text-zinc-200">{l.full_name}</td>
                  <td className="px-3 py-2 text-zinc-300" dir="ltr">
                    {l.phone}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{l.source}</td>
                  <td className="px-3 py-2 text-zinc-400">{l.follow_up ?? '—'}</td>
                  <td className="px-3 py-2 text-zinc-400">{l.note ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-left">
                    <button
                      onClick={() => startEdit(l)}
                      className="ml-2 text-xs text-zinc-400 hover:text-emerald-400"
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => handleDelete(l.id)}
                      disabled={deletingId === l.id}
                      className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                    >
                      מחיקה
                    </button>
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
