import type { ReactNode } from 'react'

/** פס שמירה דביק לטפסים ארוכים — נשאר נגיש בלי לגלול לסוף הטופס */
export function FormSaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_12px_-4px_rgb(0_0_0_/_0.08)] backdrop-blur sm:bottom-4 sm:mx-0 sm:rounded-xl sm:border sm:shadow-md">
      {children}
    </div>
  )
}
