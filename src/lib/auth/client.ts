// Only accept same-origin relative paths as a redirect target so `next`
// (which arrives from a URL query string) can never send the user off-site.
export function sanitizeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  return next
}

export function loginHref(next: string): string {
  const safeNext = sanitizeNext(next) ?? '/'
  return `/login?next=${encodeURIComponent(safeNext)}`
}
