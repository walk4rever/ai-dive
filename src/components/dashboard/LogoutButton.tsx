'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
    >
      退出登录
    </button>
  )
}
