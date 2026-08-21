'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth/client'

export function NavUser() {
  const pathname = usePathname()
  const [loggedIn, setLoggedIn] = useState(false)

  // Login navigates client-side (no remount), so re-check on every route
  // change instead of just once on mount — otherwise this stays stuck on
  // "登录" after a successful login until the next full page load.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoggedIn(isLoggedIn())
  }, [pathname])

  if (loggedIn) {
    return (
      <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
        控制台
      </Link>
    )
  }

  return (
    <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
      登录
    </Link>
  )
}
