import { Fragment, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCustomers } from '../lib/useCustomers'
import { useLeads } from '../lib/useLeads'
import { daysUntil, followUpCountdown, leadAttentionReason, needsAccessRemoval } from '../lib/businessStats'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import type { Lead } from '../types/business.types'

function followUpReason(lead: Lead): string {
  if (!lead.follow_up_at) return 'אין תאריך פולו-אפ קבוע'
  return `פולו-אפ ${followUpCountdown(lead.follow_up_at).label}`
}

function trialReason(lead: Lead): string {
  if (!lead.trial_week_expiry) return 'תקופת הניסיון פגה'
  const days = Math.abs(daysUntil(lead.trial_week_expiry))
  return `תקופת הניסיון פגה לפני ${days} ימים (${lead.trial_week_expiry})`
}

/**
 * חלונית התראות למודול העסקי: לקוחות שהמנוי שלהם פג וטרם סומנו "גישה הוסרה",
 * לידים שדורשים פולו-אפ (אין להם פולו-אפ קבוע, או שהפולו-אפ באיחור), ולידים
 * שתקופת הניסיון שלהם פגה — שלוש קבוצות נפרדות, כדי שלא יתערבבו. הרזולוציה
 * קורית אך ורק דרך הכניסה ללקוח/ליד עצמו — אין כאן כפתור "סגור התראה"
 * מהחלונית, כדי שלא תהיה אפשרות "לפטור" התראה בלי לטפל.
 */
export function NotificationsBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { customers } = useCustomers()
  const { leads } = useLeads()

  const expiredCustomers = useMemo(() => customers.filter(needsAccessRemoval), [customers])
  const followUpLeads = useMemo(
    () =>
      leads.filter((l) => {
        const reason = leadAttentionReason(l)
        return reason === 'missing_follow_up' || reason === 'overdue_follow_up'
      }),
    [leads],
  )
  const trialLeads = useMemo(
    () => leads.filter((l) => leadAttentionReason(l) === 'trial_expired'),
    [leads],
  )
  const count = expiredCustomers.length + followUpLeads.length + trialLeads.length

  if (!profile?.business_access) return null

  const sections = [
    expiredCustomers.length > 0 && (
      <DropdownMenuGroup key="customers">
        <DropdownMenuLabel>מנויים שפגו — דורשים טיפול</DropdownMenuLabel>
        {expiredCustomers.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => navigate(`/business/customers/${c.id}/edit`)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium text-foreground">{c.full_name}</span>
            <span className="text-xs text-muted-foreground">
              המנוי פג לפני {Math.abs(daysUntil(c.subscription_end_date))} ימים — יש לסמן &quot;גישה הוסרה&quot; או להאריך
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ),
    followUpLeads.length > 0 && (
      <DropdownMenuGroup key="followup-leads">
        <DropdownMenuLabel>לידים — פולו-אפ</DropdownMenuLabel>
        {followUpLeads.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => navigate(`/business/leads?focus=${l.id}`)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium text-foreground">{l.full_name}</span>
            <span className="text-xs text-muted-foreground">{followUpReason(l)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ),
    trialLeads.length > 0 && (
      <DropdownMenuGroup key="trial-leads">
        <DropdownMenuLabel>לידים — תקופת ניסיון שפגה</DropdownMenuLabel>
        {trialLeads.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => navigate(`/business/leads?focus=${l.id}`)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium text-foreground">{l.full_name}</span>
            <span className="text-xs text-muted-foreground">{trialReason(l)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ),
  ].filter(Boolean)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="התראות"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white">
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {sections.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">אין התראות כרגע</p>
        ) : (
          sections.map((section, i) => (
            <Fragment key={i}>
              {i > 0 && <DropdownMenuSeparator />}
              {section}
            </Fragment>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
