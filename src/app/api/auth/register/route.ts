import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hashPassword } from '@/lib/auth/password'
import { hashConfirmationNonce } from '@/lib/subscription/confirmation-token'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; username?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, password, username } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 422 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 422 })
  }

  if (!username || !/^[a-zA-Z0-9-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–30 characters: letters, numbers, hyphens only' },
      { status: 422 }
    )
  }

  const secret = process.env.EMAIL_CONFIRMATION_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  const supabase = await createServiceClient()

  const { data: existing } = await supabase
    .from('ai_pulse_users')
    .select('id, email_verified_at')
    .eq('email', email)
    .single()

  if (existing?.email_verified_at) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  // Check username uniqueness (exclude current user if re-registering same email)
  const { data: takenByOther } = await supabase
    .from('ai_pulse_users')
    .select('id')
    .ilike('username', username)
    .neq('email', email)
    .single()

  if (takenByOther) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const nonce = crypto.randomBytes(16).toString('base64url')
  const nonceHash = hashConfirmationNonce({ nonce, secret })
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const passwordHash = hashPassword(password)

  const { error } = await supabase.from('ai_pulse_users').upsert(
    {
      email,
      username,
      password_hash: passwordHash,
      email_verified_at: null,
      verification_nonce_hash: nonceHash,
      verification_expires_at: expiresAt,
    },
    { onConflict: 'email' }
  )

  if (error) {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }

  const verifyUrl = `${req.nextUrl.origin}/api/auth/verify?email=${encodeURIComponent(email)}&nonce=${encodeURIComponent(nonce)}`

  const { error: emailError } = await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: '验证您的邮箱 — AI-DIVE',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="font-size: 20px; font-weight: bold;">欢迎加入 AI-DIVE</h2>
        <p style="color: #555; line-height: 1.6;">点击下方链接验证邮箱，完成注册。链接 24 小时内有效。</p>
        <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500;">
          验证邮箱 →
        </a>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">如果你没有注册过 AI-DIVE，请忽略此邮件。</p>
      </div>
    `,
  })

  if (emailError) {
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 502 })
  }

  return NextResponse.json({ message: 'Verification email sent. Please check your inbox.' })
}
