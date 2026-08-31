'use client'

import { SiteChrome } from '@/components/SiteChrome'
import { ErrorContent } from '@/components/ErrorContent'

// Fallback for an error thrown above (site)/layout.tsx or (admin)/layout.tsx — e.g. a
// crash in the root layout itself. Same reasoning as app/not-found.tsx: this file
// isn't nested under (site)/, so it wraps in SiteChrome by hand.
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SiteChrome>
      <ErrorContent {...props} />
    </SiteChrome>
  )
}
