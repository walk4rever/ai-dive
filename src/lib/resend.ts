import { Resend } from 'resend'

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  return apiKey ? new Resend(apiKey) : null
}
