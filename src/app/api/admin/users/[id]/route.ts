import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Role only — this endpoint exists for exactly one action (promote/demote admin),
 *  not general user editing. Needs the full session (not just requireAdminSession's
 *  boolean) to compare the target id against the caller's own id for the
 *  self-demotion guard below. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !('role' in body)) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }

  if (!['user', 'admin'].includes(body.role)) {
    return NextResponse.json({ error: 'role must be "user" or "admin"' }, { status: 422 })
  }

  // The one footgun this route has to prevent: an admin removing their own admin
  // role and locking themselves out of /admin with no other admin account handy to
  // undo it from. Demoting someone else is allowed — that's a deliberate action with
  // another admin still able to fix it.
  if (id === session.user.id && body.role !== 'admin') {
    return NextResponse.json({ error: '不能取消自己的管理员权限，请用另一个管理员账号操作' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_users').update({ role: body.role }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/** Hard delete. ai_pulse_agents / ai_pulse_orders / ai_pulse_credit_ledger /
 *  ai_pulse_user_sessions / ai_pulse_chat_turns all reference this row with ON DELETE
 *  CASCADE — they go with it, permanently. ai_pulse_stories.user_id has no cascade
 *  (NO ACTION), so a user who has published under their own name blocks the delete
 *  with a Postgres foreign-key-violation (23503); surfaced here as a specific,
 *  actionable message instead of a generic 500. The confirm-by-typing-the-email gate
 *  lives client-side (ConfirmDeleteDialog) — this route only re-checks the one thing
 *  that can't be a client-side mistake: deleting yourself. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ error: '不能删除自己的账号' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_users').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: '该用户以自己身份发布过文章，无法删除——请先转移或删除这些文章' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
