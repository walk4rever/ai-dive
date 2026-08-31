import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { canAccessDeck } from '@/lib/decks/access'
import { fetchDeckObject } from '@/lib/r2'

interface RouteParams {
  params: Promise<{ slug: string; path: string[] }>
}

/** Content proxy for a deck's R2-hosted files (entry HTML plus every asset it
 *  references by relative path). Replaces the old next.config.ts rewrite, which
 *  forwarded this same URL shape (`/decks/:slug/:path*`) to a public bucket with no
 *  auth at all — see TODO.md 阶段 4.2. Every request re-checks entitlement, including
 *  asset requests, so a direct link to an image can't be used to route around the
 *  paywall on the entry file. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug, path } = await params

  const session = await getServerSession(authOptions)
  const supabase = await createServiceClient()
  const allowed = await canAccessDeck(supabase, session?.user.id ?? null, slug, {
    isAdmin: session?.user.role === 'admin',
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 403 })
  }

  const object = await fetchDeckObject(slug, path.join('/'))
  if (!object) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return new Response(object.stream, {
    headers: {
      'Content-Type': object.contentType,
      // private, not public/CDN — access is per-user now, so responses can't be shared
      // across visitors the way the old public rewrite's cache could.
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
