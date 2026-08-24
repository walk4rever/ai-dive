'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'

export function NavUser() {
  const { status } = useSession()

  if (status === 'authenticated') {
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
