'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function NavUser() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('user_token'))
  }, [])

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
