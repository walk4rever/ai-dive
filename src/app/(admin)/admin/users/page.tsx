import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminUsers } from '@/lib/admin/users'
import { UsersManager } from './UsersManager'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  const supabase = await createServiceClient()
  const users = await fetchAdminUsers(supabase)

  return <UsersManager initialUsers={users} currentUserId={session?.user.id ?? ''} />
}
