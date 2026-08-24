import crypto from 'crypto'

export function generateAgentKey(): { key: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url')
  const key = `aipk_${raw}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  return { key, hash }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
