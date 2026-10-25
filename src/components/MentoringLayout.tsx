import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const baseTabs = [
  { to: '/mentoring/meetings', label: 'פגישות' },
  { to: '/mentoring/students', label: 'תלמידים' },
]

const adminTabs = [{ to: '/mentoring/assignments', label: 'שיוכי מנטורים' }]

export function MentoringLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const tabs = [...baseTabs, ...(profile?.role === 'admin' ? adminTabs : [])]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <nav className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-800 p-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
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
