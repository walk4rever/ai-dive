import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function Image({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('title, excerpt')
    .eq('slug', slug)
    .single()

  const title = post?.title ?? 'AI-DIVE'
  const desc = post?.excerpt ?? '面向 AI 工程师的周刊与深度研究'
  const truncatedDesc = desc.length > 80 ? desc.slice(0, 80) + '…' : desc

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px',
        backgroundColor: '#faf9f6',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 15,
          color: '#999',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
        }}
      >
        AI-DIVE
      </div>
      <div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#1a1a1a',
            lineHeight: 1.2,
            marginBottom: 28,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 26, color: '#666', lineHeight: 1.6 }}>
          {truncatedDesc}
        </div>
      </div>
      <div style={{ fontSize: 14, color: '#bbb', letterSpacing: '0.1em' }}>
        ai.air7.fun
      </div>
    </div>,
    { ...size }
  )
}
