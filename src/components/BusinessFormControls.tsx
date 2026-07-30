import type { ReactNode } from 'react'

export const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-semibold text-zinc-400">{title}</h3>
      {children}
    </section>
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
      <span className="text-sm font-medium text-zinc-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export const filterInputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500'

/** תא סינון קומפקטי לפי כותרת עמודה, לשימוש בשורת הפילטרים מעל טבלה */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
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
    <th className="px-3 py-2 text-right font-medium">
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`flex items-center gap-1 whitespace-nowrap ${active ? 'text-emerald-400' : ''}`}
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
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{children}</span>
    </div>
  )
}
