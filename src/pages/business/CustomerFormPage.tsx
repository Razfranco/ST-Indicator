import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { daysUntil } from '../../lib/businessStats'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import type { CustomerStatus } from '../../types/business.types'

const STATUSES: CustomerStatus[] = ['active', 'paused', 'cancelled']
const statusLabel: Record<CustomerStatus, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  cancelled: 'מבוטל',
}

interface FormState {
  full_name: string
  email: string
  tv_username: string
  discord_username: string
  status: CustomerStatus
  phone: string
  plan: string
  period: string
  subscription_start_date: string
  subscription_end_date: string
  follow_up_notes: string
  mentor: string
  access: string
  password: string
}

const initialState: FormState = {
  full_name: '',
  email: '',
  tv_username: '',
  discord_username: '',
  status: 'active',
  phone: '',
  plan: '',
  period: '',
  subscription_start_date: '',
  subscription_end_date: '',
  follow_up_notes: '',
  mentor: '',
  access: '',
  password: '',
}

interface BillingFormState {
  amount: string
  billing_month: string
  billing_note: string
  is_recurring_monthly: boolean
  plan_cost: string
}

function currentMonthInput(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const initialBillingState: BillingFormState = {
  amount: '',
  billing_month: currentMonthInput(),
  billing_note: '',
  is_recurring_monthly: false,
  plan_cost: '',
}

export function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState<FormState>(initialState)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditing)

  const { billings, error: billingsError } = useCustomerBillings()
  const [billingForm, setBillingForm] = useState<BillingFormState>(initialBillingState)
  const [savingBilling, setSavingBilling] = useState(false)
  const [billingErrorMsg, setBillingErrorMsg] = useState<string | null>(null)
  const [deletingBillingId, setDeletingBillingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing || !id) return
    let cancelled = false
    supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setError('לא ניתן היה לטעון את הלקוח')
          setLoading(false)
          return
        }
        setForm({
          full_name: data.full_name,
          email: data.email ?? '',
          tv_username: data.tv_username,
          discord_username: data.discord_username,
          status: data.status,
          phone: data.phone,
          plan: data.plan,
          period: data.period,
          subscription_start_date: data.subscription_start_date,
          subscription_end_date: data.subscription_end_date,
          follow_up_notes: data.follow_up_notes ?? '',
          mentor: data.mentor,
          access: data.access,
          password: data.password ?? '',
        })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isEditing])

  const daysLeft = useMemo(
    () => (form.subscription_end_date ? daysUntil(form.subscription_end_date) : null),
    [form.subscription_end_date],
  )

  const customerBillings = useMemo(
    () => (id ? billings.filter((b) => b.customer_id === id) : []),
    [billings, id],
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateBilling<K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) {
    setBillingForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      tv_username: form.tv_username.trim(),
      discord_username: form.discord_username.trim(),
      status: form.status,
      phone: form.phone.trim(),
      plan: form.plan.trim(),
      period: form.period.trim(),
      subscription_start_date: form.subscription_start_date,
      subscription_end_date: form.subscription_end_date,
      follow_up_notes: form.follow_up_notes || null,
      mentor: form.mentor.trim(),
      access: form.access.trim(),
      password: form.password || null,
    }

    if (id) {
      const { error } = await supabase.from('customers').update(payload).eq('id', id)
      setSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      navigate('/business/customers')
      return
    }

    const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/business/customers/${data.id}/edit`)
  }

  async function handleAddBilling(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setSavingBilling(true)
    setBillingErrorMsg(null)

    const { error } = await supabase.from('customer_billings').insert({
      customer_id: id,
      amount: Number(billingForm.amount),
      billing_month: `${billingForm.billing_month}-01`,
      billing_note: billingForm.billing_note || null,
      is_recurring_monthly: billingForm.is_recurring_monthly,
      plan_cost: Number(billingForm.plan_cost),
    })

    setSavingBilling(false)
    if (error) {
      setBillingErrorMsg(error.message)
      return
    }
    setBillingForm(initialBillingState)
  }

  async function handleDeleteBilling(billingId: string) {
    if (!confirm('למחוק את החיוב? פעולה זו אינה הפיכה.')) return
    setDeletingBillingId(billingId)
    const { error } = await supabase.from('customer_billings').delete().eq('id', billingId)
    setDeletingBillingId(null)
    if (error) setBillingErrorMsg(error.message)
  }

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">טוען לקוח...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to="/business/customers" className="text-sm text-zinc-400 hover:text-zinc-200">
          ‹ חזרה ללקוחות
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h2 className="text-xl font-bold">{isEditing ? form.full_name || 'עריכת לקוח' : 'לקוח חדש'}</h2>

        {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>}

        <Section title="פרטי קשר">
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
            <Field label="אימייל">
              <input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
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
            <Field label="סטטוס" required>
              <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('status', s)}
                    className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                      form.status === s
                        ? s === 'active'
                          ? 'bg-emerald-600 text-white'
                          : s === 'paused'
                            ? 'bg-amber-600 text-white'
                            : 'bg-red-600 text-white'
                        : 'text-zinc-400'
                    }`}
                  >
                    {statusLabel[s]}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        <Section title="גישה">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="שם משתמש TradingView" required>
              <input
                type="text"
                dir="ltr"
                required
                value={form.tv_username}
                onChange={(e) => update('tv_username', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="שם משתמש Discord" required>
              <input
                type="text"
                dir="ltr"
                required
                value={form.discord_username}
                onChange={(e) => update('discord_username', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="הרשאת גישה" required>
              <input
                type="text"
                required
                value={form.access}
                onChange={(e) => update('access', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="סיסמה" hint="לשימוש פנימי בלבד">
              <input
                type="text"
                dir="ltr"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="מנוי">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="מסלול" required>
              <input
                type="text"
                required
                value={form.plan}
                onChange={(e) => update('plan', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="תקופה" required hint="לדוגמה: חודשי, שנתי">
              <input
                type="text"
                required
                value={form.period}
                onChange={(e) => update('period', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="תאריך התחלת מנוי" required>
              <input
                type="date"
                required
                value={form.subscription_start_date}
                onChange={(e) => update('subscription_start_date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="תאריך סיום מנוי"
              required
              hint={daysLeft != null ? `נותרו ${daysLeft} ימים` : undefined}
            >
              <input
                type="date"
                required
                value={form.subscription_end_date}
                onChange={(e) => update('subscription_end_date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="מנטור" required>
              <input
                type="text"
                required
                value={form.mentor}
                onChange={(e) => update('mentor', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="הערות מעקב">
            <textarea
              value={form.follow_up_notes}
              onChange={(e) => update('follow_up_notes', e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? 'שומר...' : isEditing ? 'עדכון לקוח' : 'שמירת לקוח'}
        </button>
      </form>

      {isEditing && (
        <Section title="היסטוריית חיובים">
          {billingsError && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{billingsError}</p>
          )}
          {billingErrorMsg && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{billingErrorMsg}</p>
          )}

          {customerBillings.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">אין חיובים עדיין.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">חודש</th>
                    <th className="px-3 py-2 text-right font-medium">סכום</th>
                    <th className="px-3 py-2 text-right font-medium">עלות מסלול</th>
                    <th className="px-3 py-2 text-right font-medium">רווח</th>
                    <th className="px-3 py-2 text-right font-medium">הערה</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {customerBillings.map((b) => {
                    const profit = b.amount - b.plan_cost
                    return (
                      <tr key={b.id} className="hover:bg-zinc-900/60">
                        <td className="px-3 py-2 text-zinc-300" dir="ltr">
                          {b.billing_month.slice(0, 7)}
                          {b.is_recurring_monthly && (
                            <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                              חודשי
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-200" dir="ltr">
                          ${b.amount.toLocaleString('en-US')}
                        </td>
                        <td className="px-3 py-2 text-zinc-400" dir="ltr">
                          ${b.plan_cost.toLocaleString('en-US')}
                        </td>
                        <td
                          className={`px-3 py-2 font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                          dir="ltr"
                        >
                          ${profit.toLocaleString('en-US')}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{b.billing_note ?? '—'}</td>
                        <td className="px-3 py-2 text-left">
                          <button
                            onClick={() => handleDeleteBilling(b.id)}
                            disabled={deletingBillingId === b.id}
                            className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
                          >
                            מחיקה
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={handleAddBilling} className="flex flex-col gap-4 border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-zinc-400">הוספת חיוב</h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="סכום" required>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={billingForm.amount}
                  onChange={(e) => updateBilling('amount', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="עלות מסלול" required>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={billingForm.plan_cost}
                  onChange={(e) => updateBilling('plan_cost', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="חודש חיוב" required>
                <input
                  type="month"
                  required
                  value={billingForm.billing_month}
                  onChange={(e) => updateBilling('billing_month', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="חיוב חודשי חוזר">
                <label className="flex h-[42px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3">
                  <input
                    type="checkbox"
                    checked={billingForm.is_recurring_monthly}
                    onChange={(e) => updateBilling('is_recurring_monthly', e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="text-sm text-zinc-300">חודשי</span>
                </label>
              </Field>
            </div>
            <Field label="הערת חיוב">
              <input
                type="text"
                value={billingForm.billing_note}
                onChange={(e) => updateBilling('billing_note', e.target.value)}
                placeholder="העברה בנקאית, הוראת קבע..."
                className={inputClass}
              />
            </Field>
            <button
              type="submit"
              disabled={savingBilling}
              className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingBilling ? 'שומר...' : '+ הוספת חיוב'}
            </button>
          </form>
        </Section>
      )}
    </div>
  )
}
