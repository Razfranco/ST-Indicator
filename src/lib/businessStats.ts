import type {
  AdditionalExpense,
  Customer,
  CustomerBilling,
  CustomerEffectiveStatus,
  FixedExpense,
  Lead,
} from '../types/business.types'

const monthLabels = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** מספר הימים מהיום ועד לתאריך נתון (יכול להיות שלילי אם התאריך כבר עבר) */
export function daysUntil(date: string | Date): number {
  const target = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.round((targetMidnight - todayMidnight) / 86400000)
}

/** תאריך (YYYY-MM-DD) בעוד N ימים מהיום — לשימוש בחישובי הקפאה/שחרור מנוי */
export function dateInNDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** תאריך היום בפורמט YYYY-MM-DD */
export function todayDateString(): string {
  return dateInNDays(0)
}

/**
 * סטטוס הלקוח כפי שיש להציג אותו כרגע: 'active' שכבר עבר את תאריך סיום המנוי
 * מוצג כ-'expired', בלי לשמור זאת ב-DB (הוא יכול להשתנות בלי שאף אחד יערוך את הרשומה).
 */
export function getEffectiveStatus(customer: Customer): CustomerEffectiveStatus {
  if (customer.status === 'active' && daysUntil(customer.subscription_end_date) < 0) {
    return 'expired'
  }
  return customer.status
}

/**
 * לקוח שהמנוי שלו פג וטרם סומן "גישה הוסרה" — דורש טיפול בחלונית ההתראות.
 * מתאפס אוטומטית ברגע שהמנוי מוארך (ראה 0016_notification_followup_flags.sql).
 */
export function needsAccessRemoval(customer: Customer): boolean {
  return getEffectiveStatus(customer) === 'expired' && !customer.access_removed_at
}

function addMonths(dateStr: string, n: number): Date {
  const d = new Date(dateStr)
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export interface CustomerAlerts {
  expiringSoon: boolean
  billingDueSoon: boolean
}

const ALERT_WINDOW_DAYS = 7

/**
 * הדגשה חזותית בלבד (לא מערכת התראות): מנוי שמסתיים תוך שבוע, או לקוח עם
 * חיוב חודשי חוזר שהחיוב הבא שלו (billing_month האחרון + חודש) מתקרב.
 *
 * הבדיקה מתבססת על החיוב האחרון בפועל (לפי billing_month) — לא על החיוב
 * המסומן "חודשי" האחרון. כך חיוב חדש שלא מסומן "חודשי" (למשל תשלום חד-פעמי
 * מראש שמחליף חיוב חוזר) מוציא את הלקוח מההתראה, גם אם היו לו חיובים
 * חודשיים מסומנים בעבר.
 *
 * מנוי שכבר פג (ימים לסיום שליליים) לא מקבל שום התראה — הוא כבר "מנוי פג"
 * (getEffectiveStatus), לא "מסתיים בקרוב", וגם לא רלוונטי לחשב עבורו חיוב הבא.
 */
export function getCustomerAlerts(customer: Customer, billings: CustomerBilling[]): CustomerAlerts {
  const daysLeft = daysUntil(customer.subscription_end_date)
  if (daysLeft < 0) {
    return { expiringSoon: false, billingDueSoon: false }
  }

  const expiringSoon = daysLeft <= ALERT_WINDOW_DAYS

  const latestBilling = billings
    .filter((b) => b.customer_id === customer.id)
    .sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0]

  const billingDueSoon =
    latestBilling && latestBilling.is_recurring_monthly
      ? daysUntil(addMonths(latestBilling.billing_month, 1)) <= ALERT_WINDOW_DAYS
      : false

  return { expiringSoon, billingDueSoon }
}

/**
 * כמה פעמים הוצאה קבועה (חוזרת) חלה בטווח תאריכים נתון [rangeStart, rangeEnd]
 * (כולל שני הקצוות), החל מ-start_date שלה. שימושי לכל טווח — חודש בודד או שנה שלמה.
 */
export function countFixedExpenseOccurrences(
  startDateStr: string,
  recurrence: FixedExpense['recurrence'],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const startDate = new Date(startDateStr)
  if (rangeEnd < startDate) return 0

  if (recurrence === 'weekly') {
    const from = startDate > rangeStart ? startDate : rangeStart
    const daysSinceStart = Math.round((from.getTime() - startDate.getTime()) / 86400000)
    const offset = daysSinceStart % 7
    const firstOccurrence = new Date(from.getTime() + (offset === 0 ? 0 : 7 - offset) * 86400000)
    if (firstOccurrence > rangeEnd) return 0
    const daysSpan = Math.round((rangeEnd.getTime() - firstOccurrence.getTime()) / 86400000)
    return Math.floor(daysSpan / 7) + 1
  }

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const step = recurrence === 'monthly' ? () => cursor.setMonth(cursor.getMonth() + 1) : () => cursor.setFullYear(cursor.getFullYear() + 1)
  while (cursor < rangeStart) step()
  let count = 0
  while (cursor <= rangeEnd) {
    count++
    step()
  }
  return count
}

/** סך תרומת כל ההוצאות הקבועות לטווח תאריכים נתון (מספר המופעים × הסכום, לכל הוצאה) */
export function sumFixedExpensesInRange(
  fixedExpenses: FixedExpense[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  return fixedExpenses.reduce(
    (sum, e) => sum + countFixedExpenseOccurrences(e.start_date, e.recurrence, rangeStart, rangeEnd) * e.amount,
    0,
  )
}

export interface YearMonthPoint {
  key: string
  monthIndex: number
  label: string
  income: number
  planCost: number
  expenses: number
  net: number
  hasData: boolean
}

/** 12 המשבצות (ינואר–דצמבר) של שנה נתונה, לתצוגת "יומן שנתי" של תזרים */
export function computeYearCashflow(
  billings: CustomerBilling[],
  expenses: AdditionalExpense[],
  fixedExpenses: FixedExpense[],
  year: number,
): YearMonthPoint[] {
  const months: YearMonthPoint[] = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${pad2(i + 1)}`,
    monthIndex: i,
    label: monthLabels[i],
    income: 0,
    planCost: 0,
    expenses: 0,
    net: 0,
    hasData: false,
  }))

  for (const b of billings) {
    const d = new Date(b.billing_month)
    if (d.getFullYear() !== year) continue
    const m = months[d.getMonth()]
    m.income += b.amount
    m.planCost += b.plan_cost
    m.hasData = true
  }

  for (const e of expenses) {
    const d = new Date(e.expense_month)
    if (d.getFullYear() !== year) continue
    const m = months[d.getMonth()]
    m.expenses += e.amount
    m.hasData = true
  }

  for (const m of months) {
    const monthStart = new Date(year, m.monthIndex, 1)
    const monthEnd = new Date(year, m.monthIndex + 1, 0, 23, 59, 59, 999)
    const fixedTotal = sumFixedExpensesInRange(fixedExpenses, monthStart, monthEnd)
    if (fixedTotal > 0) {
      m.expenses += fixedTotal
      m.hasData = true
    }
  }

  for (const m of months) {
    m.net = m.income - m.planCost - m.expenses
  }

  return months
}

/** מפתח 'YYYY-MM' של תאריך, לשיוך לחודש (לסינון הוצאות/חיובים) */
export function monthKeyOf(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** מחרוזת 'YYYY-MM' של החודש הנוכחי, לערך ברירת מחדל של input[type=month] */
export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export interface FollowUpCountdown {
  label: string
  overdue: boolean
  dueSoon: boolean
}

const FOLLOW_UP_SOON_MS = 24 * 60 * 60 * 1000

/** כמה זמן נשאר (או עבר) עד מועד פולו-אפ נתון, לתצוגה ולהדגשה חזותית */
export function followUpCountdown(datetime: string): FollowUpCountdown {
  const diffMs = new Date(datetime).getTime() - Date.now()
  const overdue = diffMs < 0
  const absMs = Math.abs(diffMs)

  const minutes = Math.round(absMs / 60000)
  const hours = Math.round(absMs / 3600000)
  const days = Math.round(absMs / 86400000)

  let amount: string
  if (minutes < 60) amount = `${minutes} דק'`
  else if (hours < 24) amount = `${hours} שע'`
  else amount = `${days} ימים`

  return {
    label: overdue ? `באיחור של ${amount}` : `בעוד ${amount}`,
    overdue,
    dueSoon: !overdue && absMs <= FOLLOW_UP_SOON_MS,
  }
}

export type LeadAttentionReason = 'missing_follow_up' | 'overdue_follow_up' | 'trial_expired'

/**
 * הסיבה (אם יש) שליד דורש טיפול בחלונית ההתראות: לא "לא רלוונטי", לא סומן
 * "טופל", ובנוסף אין לו פולו-אפ עתידי קבוע (אין תאריך פולו-אפ, הפולו-אפ
 * באיחור), או שתוקף תקופת הניסיון שלו עבר. הפולו-אפ נבדק קודם — ליד
 * בתקופת ניסיון עם פולו-אפ באיחור מסווג כ"פולו-אפ", לא כפול.
 */
export function leadAttentionReason(lead: Lead): LeadAttentionReason | null {
  if (lead.status === 'not_relevant' || lead.handled) return null
  if (!lead.follow_up_at) return 'missing_follow_up'
  if (followUpCountdown(lead.follow_up_at).overdue) return 'overdue_follow_up'
  if (lead.status === 'trial_week' && lead.trial_week_expiry && daysUntil(lead.trial_week_expiry) < 0) return 'trial_expired'
  return null
}

/** ליד שדורש טיפול בחלונית ההתראות — ראה leadAttentionReason לפירוט הסיבה */
export function leadNeedsAttention(lead: Lead): boolean {
  return leadAttentionReason(lead) !== null
}
