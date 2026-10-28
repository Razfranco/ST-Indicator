import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useCustomerBillings } from '../../lib/useCustomerBillings'
import { daysUntil } from '../../lib/businessStats'
import { ShieldAlert } from 'lucide-react'
import { Section, Field, inputClass } from '../../components/BusinessFormControls'
import { Button } from '../../components/ui/button'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { FormSaveBar } from '../../components/FormSaveBar'
import { toast } from '../../components/ui/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
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
  access_removed_at: string | null
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
  access_removed_at: null,
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
  const [confirmDeleteBillingId, setConfirmDeleteBillingId] = useState<string | null>(null)

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
          access_removed_at: data.access_removed_at,
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

  const isExpired = form.status === 'active' && daysLeft != null && daysLeft < 0

  const [markingAccessRemoved, setMarkingAccessRemoved] = useState(false)

  async function handleMarkAccessRemoved() {
    if (!id) return
    setMarkingAccessRemoved(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('customers').update({ access_removed_at: now }).eq('id', id)
    setMarkingAccessRemoved(false)
    if (error) {
      toast.add({ title: 'שגיאה בסימון "גישה הוסרה"', description: error.message, type: 'error' })
      return
    }
    update('access_removed_at', now)
    toast.add({ title: 'סומן: גישה הוסרה', type: 'success' })
  }

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
      // כל עוד המנוי אינו פג יותר (הוארך/שונה סטטוס) — מאפסים את סימון "גישה הוסרה",
      // כדי שהתראה תוכל לחזור אם המנוי יפוג שוב בעתיד.
      access_removed_at:
        form.status === 'active' && daysUntil(form.subscription_end_date) < 0 ? form.access_removed_at : null,
    }

    if (id) {
      const { error } = await supabase.from('customers').update(payload).eq('id', id)
      setSaving(false)
      if (error) {
        setError(error.message)
        toast.add({ title: 'שגיאה בעדכון הלקוח', description: error.message, type: 'error' })
        return
      }
      toast.add({ title: 'הלקוח עודכן בהצלחה', type: 'success' })
      navigate('/business/customers')
      return
    }

    const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
    setSaving(false)
    if (error) {
      setError(error.message)
      toast.add({ title: 'שגיאה בשמירת הלקוח', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'הלקוח נשמר בהצלחה', type: 'success' })
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
      toast.add({ title: 'שגיאה בהוספת חיוב', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'החיוב נוסף בהצלחה', type: 'success' })
    setBillingForm(initialBillingState)
  }

  async function handleDeleteBilling(billingId: string) {
    setDeletingBillingId(billingId)
    const { error } = await supabase.from('customer_billings').delete().eq('id', billingId)
    setDeletingBillingId(null)
    setConfirmDeleteBillingId(null)
    if (error) {
      setBillingErrorMsg(error.message)
      toast.add({ title: 'שגיאה במחיקת החיוב', description: error.message, type: 'error' })
      return
    }
    toast.add({ title: 'החיוב נמחק', type: 'success' })
  }

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">טוען לקוח...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to="/business/customers" className="text-sm text-muted-foreground hover:text-foreground">
          ‹ חזרה ללקוחות
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h2 className="font-heading text-xl font-semibold">
          {isEditing ? form.full_name || 'עריכת לקוח' : 'לקוח חדש'}
        </h2>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {isEditing && isExpired && !form.access_removed_at && (
          <Alert variant="destructive" className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
              <AlertDescription className="text-destructive">
                המנוי של הלקוח הזה פג. סמן/י שהגישה הוסרה בפועל, או הארך/י את תאריך סיום המנוי למטה ושמור/י.
              </AlertDescription>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={markingAccessRemoved}
                onClick={handleMarkAccessRemoved}
              >
                {markingAccessRemoved ? 'מסמן...' : 'סמן גישה הוסרה'}
              </Button>
            </div>
          </Alert>
        )}

        {isEditing && isExpired && form.access_removed_at && (
          <Alert className="border-primary/30 bg-primary/5">
            <AlertDescription className="text-primary">
              סומן כ"גישה הוסרה" בתאריך {new Date(form.access_removed_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}.
            </AlertDescription>
          </Alert>
        )}

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
              <div className="flex gap-1 rounded-lg border border-input bg-muted p-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('status', s)}
                    className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                      form.status === s
                        ? s === 'active'
                          ? 'bg-primary text-primary-foreground'
                          : s === 'paused'
                            ? 'bg-amber-600 text-white'
                            : 'bg-destructive text-white'
                        : 'text-muted-foreground'
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

        <FormSaveBar>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'שומר...' : isEditing ? 'עדכון לקוח' : 'שמירת לקוח'}
          </Button>
        </FormSaveBar>
      </form>

      {isEditing && (
        <Section title="היסטוריית חיובים">
          {billingsError && (
            <Alert variant="destructive">
              <AlertDescription className="text-destructive">{billingsError}</AlertDescription>
            </Alert>
          )}
          {billingErrorMsg && (
            <Alert variant="destructive">
              <AlertDescription className="text-destructive">{billingErrorMsg}</AlertDescription>
            </Alert>
          )}

          {customerBillings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">אין חיובים עדיין.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[560px]">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>חודש</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>עלות מסלול</TableHead>
                    <TableHead>רווח</TableHead>
                    <TableHead>הערה</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerBillings.map((b) => {
                    const profit = b.amount - b.plan_cost
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted-foreground" dir="ltr">
                          {b.billing_month.slice(0, 7)}
                          {b.is_recurring_monthly && (
                            <Badge variant="outline" className="me-2 border-transparent bg-muted text-muted-foreground">
                              חודשי
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground" dir="ltr">
                          {b.amount.toLocaleString('en-US')} ₪
                        </TableCell>
                        <TableCell className="text-muted-foreground" dir="ltr">
                          {b.plan_cost.toLocaleString('en-US')} ₪
                        </TableCell>
                        <TableCell
                          className={`font-medium ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}
                          dir="ltr"
                        >
                          {profit.toLocaleString('en-US')} ₪
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.billing_note ?? '—'}</TableCell>
                        <TableCell className="text-left">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteBillingId(b.id)}
                            disabled={deletingBillingId === b.id}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            מחיקה
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <form onSubmit={handleAddBilling} className="flex flex-col gap-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-muted-foreground">הוספת חיוב</h4>
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
                <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3">
                  <input
                    type="checkbox"
                    checked={billingForm.is_recurring_monthly}
                    onChange={(e) => updateBilling('is_recurring_monthly', e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">חודשי</span>
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
            <Button type="submit" disabled={savingBilling} className="self-start">
              {savingBilling ? 'שומר...' : '+ הוספת חיוב'}
            </Button>
          </form>
        </Section>
      )}

      <AlertDialog open={confirmDeleteBillingId != null} onOpenChange={(next: boolean) => !next && setConfirmDeleteBillingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת חיוב</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה. למחוק את החיוב?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmDeleteBillingId && handleDeleteBilling(confirmDeleteBillingId)}
            >
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
