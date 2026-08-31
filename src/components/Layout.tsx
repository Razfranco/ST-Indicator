import type { ComponentType, ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType
}

export function Layout({ children, navItems }: { children: ReactNode; navItems: NavItem[] }) {
  const { signOut, user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white p-1">
                <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-lg font-bold" dir="ltr">ST Indicator</h1>
            </div>
            <Link
              to="/"
              className="flex items-center gap-1 rounded-md py-0.5 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              <SwitchIcon />
              <span>החלפת פלטפורמה</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 sm:inline" dir="ltr">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            >
              יציאה
            </button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 sm:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 sm:pb-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-800 bg-zinc-950/95 backdrop-blur sm:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-emerald-400' : 'text-zinc-500'
              }`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

export function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  )
}

export function AdminIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 3 4 6v6c0 4.5 3.2 7.9 8 9 4.8-1.1 8-4.5 8-9V6l-8-3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BriefcaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SwitchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h13M17 7l-4-4M17 7l-4 4M20 17H7M7 17l4 4M7 17l4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
