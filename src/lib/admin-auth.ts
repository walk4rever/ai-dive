import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function requireAdminSession(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return session?.user.role === 'admin'
}
