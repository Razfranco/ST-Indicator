import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCustomers } from '../lib/useCustomers'
import { useLeads } from '../lib/useLeads'
import { daysUntil, followUpCountdown, leadNeedsAttention, needsAccessRemoval } from '../lib/businessStats'
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

function leadReason(lead: Lead): string {
  if (!lead.follow_up_at) return 'אין תאריך פולו-אפ קבוע'
  const countdown = followUpCountdown(lead.follow_up_at)
  if (countdown.overdue) return `פולו-אפ ${countdown.label}`
  return 'תוקף שבוע הניסיון עבר'
}

/**
 * חלונית התראות למודול העסקי: לקוחות שהמנוי שלהם פג וטרם סומנו "גישה הוסרה",
 * ולידים שדורשים טיפול (אין להם פולו-אפ קבוע, הפולו-אפ באיחור, או שתוקף שבוע
 * הניסיון עבר). הרזולוציה קורית אך ורק דרך הכניסה ללקוח/ליד עצמו — אין כאן
 * כפתור "סגור התראה" מהחלונית, כדי שלא תהיה אפשרות "לפטור" התראה בלי לטפל.
 */
export function NotificationsBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { customers } = useCustomers()
  const { leads } = useLeads()

  const expiredCustomers = useMemo(() => customers.filter(needsAccessRemoval), [customers])
  const attentionLeads = useMemo(() => leads.filter(leadNeedsAttention), [leads])
  const count = expiredCustomers.length + attentionLeads.length

  if (!profile?.business_access) return null

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
        {count === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">אין התראות כרגע</p>
        ) : (
          <>
            {expiredCustomers.length > 0 && (
              <DropdownMenuGroup>
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
            )}
            {expiredCustomers.length > 0 && attentionLeads.length > 0 && <DropdownMenuSeparator />}
            {attentionLeads.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>לידים שדורשים טיפול</DropdownMenuLabel>
                {attentionLeads.map((l) => (
                  <DropdownMenuItem
                    key={l.id}
                    onClick={() => navigate(`/business/leads?focus=${l.id}`)}
                    className="flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-medium text-foreground">{l.full_name}</span>
                    <span className="text-xs text-muted-foreground">{leadReason(l)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
