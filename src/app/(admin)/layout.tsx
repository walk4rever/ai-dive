import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { AdminShell } from '@/components/admin/AdminShell'

/** Every page under (admin)/ used to repeat this exact check. Centralizing it here
 *  means a new admin page just needs a page.tsx — no copy-pasted redirect. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect(loginHref('/admin'))

  return <AdminShell>{children}</AdminShell>
}
