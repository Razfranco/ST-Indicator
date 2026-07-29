import type { AdditionalExpense, Customer, CustomerBilling } from '../types/business.types'

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
 */
export function getCustomerAlerts(customer: Customer, billings: CustomerBilling[]): CustomerAlerts {
  const expiringSoon = daysUntil(customer.subscription_end_date) <= ALERT_WINDOW_DAYS

  const latestRecurring = billings
    .filter((b) => b.customer_id === customer.id && b.is_recurring_monthly)
    .sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0]

  const billingDueSoon = latestRecurring
    ? daysUntil(addMonths(latestRecurring.billing_month, 1)) <= ALERT_WINDOW_DAYS
    : false

  return { expiringSoon, billingDueSoon }
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
