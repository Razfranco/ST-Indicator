export type CustomerStatus = 'active' | 'paused' | 'cancelled'

export type Customer = {
  id: string
  created_at: string
  full_name: string
  email: string | null
  tv_username: string
  discord_username: string
  status: CustomerStatus
  phone: string
  plan: string
  period: string
  subscription_start_date: string
  subscription_end_date: string
  follow_up_notes: string | null
  mentor: string
  access: string
  password: string | null
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at'> &
  Partial<Pick<Customer, 'id' | 'created_at'>>
export type CustomerUpdate = Partial<CustomerInsert>

export type CustomerBilling = {
  id: string
  created_at: string
  customer_id: string
  amount: number
  billing_month: string
  billing_note: string | null
  is_recurring_monthly: boolean
  plan_cost: number
}

export type CustomerBillingInsert = Omit<CustomerBilling, 'id' | 'created_at'> &
  Partial<Pick<CustomerBilling, 'id' | 'created_at'>>
export type CustomerBillingUpdate = Partial<CustomerBillingInsert>

export type LeadStatus = 'relevant' | 'not_relevant' | 'trial_week'

export type Lead = {
  id: string
  created_at: string
  full_name: string
  phone: string
  source: string
  note: string | null
  follow_up: string | null
  follow_up_at: string | null
  status: LeadStatus
  trial_week_expiry: string | null
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at'> & Partial<Pick<Lead, 'id' | 'created_at'>>
export type LeadUpdate = Partial<LeadInsert>

export type AdditionalExpense = {
  id: string
  created_at: string
  expense_name: string
  amount: number
  note: string
  expense_month: string
}

export type AdditionalExpenseInsert = Omit<AdditionalExpense, 'id' | 'created_at'> &
  Partial<Pick<AdditionalExpense, 'id' | 'created_at'>>
export type AdditionalExpenseUpdate = Partial<AdditionalExpenseInsert>
