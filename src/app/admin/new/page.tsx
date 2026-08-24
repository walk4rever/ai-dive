import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { NewPostForm } from './NewPostForm'

export default async function NewPostPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect(loginHref('/admin'))

  return <NewPostForm />
}
