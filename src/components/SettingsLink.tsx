import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
export function SettingsLink({ className = '' }: { className?: string }) {
  return <Link to="/settings" aria-label="הגדרות" title="הגדרות" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}><Settings className="h-5 w-5" aria-hidden="true" /></Link>
}
