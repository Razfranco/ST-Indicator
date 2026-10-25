import type { ComponentType, ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowLeftRight, BarChart3, FileText, List, Plus, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType
}

export function Layout({ children, navItems }: { children: ReactNode; navItems: NavItem[] }) {
  const { signOut, user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border">
                <img src="/icons/icon-512.png" alt="" className="h-full w-full object-contain" />
              </div>
              <h1 className="font-heading text-lg font-semibold" dir="ltr">
                ST Indicator
              </h1>
            </div>
            <Link
              to="/"
              className="flex items-center gap-1 rounded-md py-0.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>החלפת פלטפורמה</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline" dir="ltr">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              יציאה
            </Button>
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
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 sm:pb-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background/95 backdrop-blur sm:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
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
  return <List className="h-5 w-5" />
}

export function PlusIcon() {
  return <Plus className="h-5 w-5" />
}

export function ChartIcon() {
  return <BarChart3 className="h-5 w-5" />
}

export function DocIcon() {
  return <FileText className="h-5 w-5" />
}

export function AdminIcon() {
  return <ShieldCheck className="h-5 w-5" />
}
