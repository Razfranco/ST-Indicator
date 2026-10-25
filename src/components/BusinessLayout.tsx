import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/business/customers', label: 'לקוחות' },
  { to: '/business/leads', label: 'לידים' },
  { to: '/business/expenses', label: 'הוצאות' },
  { to: '/business/cashflow', label: 'תזרים' },
  { to: '/business/treasury', label: 'קופה' },
]

export function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  )
}
