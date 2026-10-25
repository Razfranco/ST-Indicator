import type { ReactNode } from 'react'
import { Card } from './ui/card'

export const inputClass =
  'flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-4 p-5 shadow-sm">
      <h3 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </Card>
  )
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const filterInputClass =
  'flex h-8 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20'

/** תא סינון קומפקטי לפי כותרת עמודה, לשימוש בשורת הפילטרים מעל טבלה */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export type SortDir = 'asc' | 'desc'

/** כותרת עמודה בת-מיון: לחיצה ממיינת asc/desc עם חץ, לחיצה נוספת הופכת כיוון */
export function SortHeader<F extends string>({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string
  field: F
  current: F | null
  dir: SortDir
  onClick: (field: F) => void
}) {
  const active = current === field
  return (
    <th className="h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-muted-foreground">
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground ${active ? 'text-primary' : ''}`}
      >
        {label}
        {active && <span>{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}

/** שדה label:value קומפקטי, לשימוש בתצוגת כרטיס (מובייל) במקום עמודת טבלה */
export function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}
