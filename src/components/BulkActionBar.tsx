import type { ReactNode } from 'react'
import { Button } from './ui/button'

/** פס פעולות קבוצתיות דביק, מופיע מעל רשימה/טבלה כשיש שורות נבחרות */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  if (count === 0) return null

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md">
      <span className="text-sm font-medium text-foreground">{count} נבחרו</span>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>
          ביטול בחירה
        </Button>
      </div>
    </div>
  )
}
