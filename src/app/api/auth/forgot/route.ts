import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hashConfirmationNonce } from '@/lib/subscription/confirmation-token'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 422 })
  }

  const secret = process.env.EMAIL_CONFIRMATION_SECRET
  if (!secret) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })

  const supabase = await createServiceClient()
  const { data: user } = await supabase
    .from('ai_pulse_users')
    .select('id, email_verified_at')
    .eq('email', email)
    .single()

  // Always return success to prevent email enumeration
  if (!user || !user.email_verified_at) {
    return NextResponse.json({ message: 'If this email is registered, a reset link has been sent.' })
  }

  const nonce = crypto.randomBytes(16).toString('base64url')
  const nonceHash = hashConfirmationNonce({ nonce, secret })
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  await supabase
    .from('ai_pulse_users')
    .update({ reset_nonce_hash: nonceHash, reset_expires_at: expiresAt })
    .eq('id', user.id)

  const resetUrl = `${req.nextUrl.origin}/reset?email=${encodeURIComponent(email)}&nonce=${encodeURIComponent(nonce)}`

  await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: '重置密码 — AI-DIVE',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="font-size: 20px; font-weight: bold;">重置密码</h2>
        <p style="color: #555; line-height: 1.6;">点击下方链接重置密码。链接 1 小时内有效。</p>
        <a href="${resetUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500;">
          重置密码 →
        </a>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">如果你没有请求重置密码，请忽略此邮件。</p>
      </div>
    `,
  })

  return NextResponse.json({ message: 'If this email is registered, a reset link has been sent.' })
}
