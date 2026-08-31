import { NotFoundContent } from '@/components/NotFoundContent'

// Catches notFound() calls (or an unmatched dynamic segment, e.g. /post/[slug]) from
// anywhere under (site)/ — this file is nested inside (site)/layout.tsx, so it's
// wrapped in the site chrome automatically. See NotFoundContent for why the markup
// itself lives in a shared component instead of here.
export default function NotFound() {
  return <NotFoundContent />
}
