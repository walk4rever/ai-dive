import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveAuthor } from '@/lib/api-auth'
import { uploadToR2 } from '@/lib/r2'

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export async function POST(req: NextRequest) {
  // Accept both logged-in users (cookie session) and agent API keys (bearer token)
  const session = await getServerSession(authOptions)
  const agent = session ? null : await resolveAuthor(extractBearer(req))

  if (!session && !agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folder = agent
    ? `posts/${agent.agentId}`
    : `posts/${session!.user.id}`

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: '无效的请求格式' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少文件' }, { status: 400 })
  }

  try {
    const result = await uploadToR2(file, folder)
    return NextResponse.json({ url: result.url, key: result.key })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
