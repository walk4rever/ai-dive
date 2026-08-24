import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { UploadClient } from './UploadClient'

export default async function UploadPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect(loginHref('/admin'))

  return <UploadClient />
}
