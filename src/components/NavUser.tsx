'use client'

import { useSyncExternalStore } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const emptySubscribe = () => () => {}

const BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium shadow-sm bg-[var(--accent)] text-[#faf9f5] hover:bg-[var(--accent-hover)] transition-all active:scale-95'

export function NavUser() {
  const { status } = useSession()
  const pathname = usePathname()
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  if (isClient && status === 'authenticated') {
    return (
      <Link href="/dashboard" className={BUTTON_CLASS} suppressHydrationWarning>
        控制台
      </Link>
    )
  }

  const isLoginPage = pathname === '/login'

  return (
    <Link
      href={isLoginPage ? '/register' : '/login'}
      className={BUTTON_CLASS}
      suppressHydrationWarning
    >
      {isLoginPage ? '注册' : '登录'}
    </Link>
  )
}
