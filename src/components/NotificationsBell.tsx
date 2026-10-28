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
  if (!lead.follow_up_at) return ''
  return `פולו-אפ ${followUpCountdown(lead.follow_up_at).label}`
}

function trialReason(lead: Lead): string {
  if (!lead.trial_week_expiry) return 'תקופת הניסיון מסתיימת'
  const days = daysUntil(lead.trial_week_expiry)
  if (days > 0) return `תקופת הניסיון מסתיימת בעוד ${days === 1 ? 'יום' : `${days} ימים`} (${lead.trial_week_expiry})`
  if (days === 0) return `תקופת הניסיון מסתיימת היום (${lead.trial_week_expiry})`
  return `תקופת הניסיון פגה לפני ${Math.abs(days)} ימים (${lead.trial_week_expiry})`
}

/** תיאור באדום רק עבור מועד שכבר עבר (מנוי/פולו-אפ/תקופת ניסיון) — לא עבור מועד קרוב שעוד לא הגיע */
const reasonClass = (overdue: boolean) => (overdue ? 'text-destructive' : 'text-muted-foreground')

/**
 * חלונית התראות למודול העסקי, בשלוש קבוצות שלא מתערבבות: לקוחות שהמנוי שלהם
 * פג וטרם סומנו "גישה הוסרה"; לידים "רלוונטי" עם פולו-אפ קבוע שקרוב (בתוך
 * שבוע) או שכבר עבר — ליד בלי פולו-אפ קבוע כלל לא מקבל התראה; ולידים
 * ב"תקופת ניסיון" שהתקופה שלהם מסתיימת (מיום לפני התום ואילך, כולל אחרי
 * שכבר פגה) — נבדק אך ורק לפי תוקף התקופה, לא לפי פולו-אפ. תיאור באדום =
 * מועד שכבר עבר; תיאור רגיל = מועד קרוב שעוד לא הגיע. הרזולוציה קורית אך ורק
 * דרך הכניסה ללקוח/ליד עצמו — אין כאן כפתור "סגור התראה" מהחלונית, כדי שלא
 * תהיה אפשרות "לפטור" התראה בלי לטפל.
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
        return reason === 'follow_up_soon' || reason === 'overdue_follow_up'
      }),
    [leads],
  )
  const trialLeads = useMemo(
    () => leads.filter((l) => leadAttentionReason(l) === 'trial_ending'),
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
            <span className="text-xs text-destructive">
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
            <span className={`text-xs ${reasonClass(leadAttentionReason(l) === 'overdue_follow_up')}`}>
              {followUpReason(l)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ),
    trialLeads.length > 0 && (
      <DropdownMenuGroup key="trial-leads">
        <DropdownMenuLabel>לידים — תקופת ניסיון</DropdownMenuLabel>
        {trialLeads.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => navigate(`/business/leads?focus=${l.id}`)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium text-foreground">{l.full_name}</span>
            <span className={`text-xs ${reasonClass(Boolean(l.trial_week_expiry) && daysUntil(l.trial_week_expiry!) < 0)}`}>
              {trialReason(l)}
            </span>
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
