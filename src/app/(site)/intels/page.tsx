import { redirect } from 'next/navigation'
import { getTodayYmd, parseYmd } from '@/lib/timezone'
import { intelDatePath } from '@/lib/intel-links'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ d?: string; m?: string }>
}

export default async function IntelIndexPage({ searchParams }: Props) {
  const { d, m } = await searchParams
  const today = getTodayYmd()

  if (d && parseYmd(d)) redirect(intelDatePath(d))

  const monthView = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
    ? `?m=${m}`
    : ''
  redirect(`${intelDatePath(today)}${monthView}`)
}
