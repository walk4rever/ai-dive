'use client'

import { ErrorContent } from '@/components/ErrorContent'

// Catches a thrown error from anywhere under (site)/ — nested inside (site)/layout.tsx,
// so it renders with site chrome for free. See ErrorContent for why the markup lives
// in a shared component instead of here.
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent {...props} />
}
