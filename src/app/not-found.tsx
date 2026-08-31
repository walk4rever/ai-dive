import { SiteChrome } from '@/components/SiteChrome'
import { NotFoundContent } from '@/components/NotFoundContent'

// Fallback for a URL that doesn't resolve to ANY route segment, not even within
// (site)/ — Next.js can only use a not-found.tsx nested under the layout(s) it walked
// through to find a match, and an entirely unmatched path never enters (site)/'s
// subtree, so it lands here instead of `(site)/not-found.tsx`. This file sits outside
// (site)/layout.tsx, so it isn't wrapped by it automatically — SiteChrome is applied
// by hand to keep the same look for this one edge case.
export default function RootNotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  )
}
