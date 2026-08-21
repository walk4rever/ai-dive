'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isLoggedIn, loginHref } from '@/lib/auth/client'

interface AuthGateProps {
  children: ReactNode
}

// Client-only gate: this app has no server-readable session (the token
// lives in localStorage), so protected pages can only check auth after
// hydration. Renders nothing until the check completes, then either the
// page content or (having already redirected) nothing at all.
export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    if (isLoggedIn()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthed(true)
      return
    }
    router.replace(loginHref(pathname))
  }, [pathname, router])

  if (!authed) return null
  return <>{children}</>
}
