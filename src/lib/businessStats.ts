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

export interface CashflowMonthPoint {
  key: string
  label: string
  income: number
  planCost: number
  expenses: number
  net: number
}

function monthKeyLabel(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr)
  const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
  const label = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`
  return { key, label }
}

/** תזרים חודשי: הכנסות (amount) פחות עלויות מסלול (plan_cost) פחות הוצאות נוספות */
export function computeCashflowByMonth(
  billings: CustomerBilling[],
  expenses: AdditionalExpense[],
  limit = 12,
): CashflowMonthPoint[] {
  const map = new Map<string, CashflowMonthPoint>()

  function ensure(key: string, label: string): CashflowMonthPoint {
    let point = map.get(key)
    if (!point) {
      point = { key, label, income: 0, planCost: 0, expenses: 0, net: 0 }
      map.set(key, point)
    }
    return point
  }

  for (const b of billings) {
    const { key, label } = monthKeyLabel(b.billing_month)
    const point = ensure(key, label)
    point.income += b.amount
    point.planCost += b.plan_cost
  }

  for (const e of expenses) {
    const { key, label } = monthKeyLabel(e.expense_month)
    const point = ensure(key, label)
    point.expenses += e.amount
  }

  const points = [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  for (const p of points) {
    p.net = p.income - p.planCost - p.expenses
  }
  return points.slice(-limit)
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
