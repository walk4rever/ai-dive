import Link from 'next/link'

type ConfirmationStatus =
  | 'success'
  | 'invalid'
  | 'expired'
  | 'error'
  | 'unsubscribed'
  | 'unsubscribe-invalid'
  | 'unsubscribe-error'

interface ConfirmationPageProps {
  searchParams: Promise<{ status?: string }>
}

const contentByStatus: Record<
  ConfirmationStatus,
  {
    label: string
    title: string
    description: string
  }
> = {
  success: {
    label: 'Confirmed',
    title: '订阅确认成功',
    description: '你的邮箱已完成确认，后续将收到 AI-DIVE 的更新邮件。',
  },
  invalid: {
    label: 'Invalid Link',
    title: '确认链接无效',
    description: '该链接不正确或已被篡改。请重新提交订阅以获取新的确认邮件。',
  },
  expired: {
    label: 'Link Expired',
    title: '确认链接已过期',
    description: '为了保证安全，确认链接有有效期。请重新提交订阅，我们会发送新的确认邮件。',
  },
  error: {
    label: 'Error',
    title: '确认失败',
    description: '系统暂时无法完成确认，请稍后再试。如果问题持续，请重新订阅。',
  },
  unsubscribed: {
    label: 'Unsubscribed',
    title: '你已取消订阅',
    description: '后续将不再收到 AI-DIVE 的更新邮件。你随时可以重新订阅。',
  },
  'unsubscribe-invalid': {
    label: 'Invalid Link',
    title: '退订链接无效',
    description: '该退订链接不正确、已失效，或当前邮箱并非有效订阅状态。',
  },
  'unsubscribe-error': {
    label: 'Error',
    title: '退订失败',
    description: '系统暂时无法完成退订，请稍后重试。',
  },
}

function isConfirmationStatus(value?: string): value is ConfirmationStatus {
  return (
    value === 'success' ||
    value === 'invalid' ||
    value === 'expired' ||
    value === 'error' ||
    value === 'unsubscribed' ||
    value === 'unsubscribe-invalid' ||
    value === 'unsubscribe-error'
  )
}

export default async function ConfirmedPage({ searchParams }: ConfirmationPageProps) {
  const { status } = await searchParams
  const resolvedStatus: ConfirmationStatus = isConfirmationStatus(status) ? status : 'invalid'
  const content = contentByStatus[resolvedStatus]
  const isUnsubscribeFlow =
    resolvedStatus === 'unsubscribed' ||
    resolvedStatus === 'unsubscribe-invalid' ||
    resolvedStatus === 'unsubscribe-error'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="border-l-4 border-[var(--accent)] pl-6 py-2">
        <p className="kicker mb-4" style={{ color: 'var(--accent)' }}>{content.label}</p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-[1.15] tracking-tight">
          {content.title}
        </h1>
      </div>
      <p className="mt-8 text-lg text-[var(--muted)] leading-relaxed">{content.description}</p>
      <div className="mt-10 flex flex-wrap gap-4 pt-8 border-t border-[var(--border)]">
        <Link
          href="/subscribe"
          className="inline-flex items-center bg-[var(--accent)] text-[#faf9f5] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--accent-coral)] transition-colors shadow-[0_0_0_1px_var(--accent),0_4px_12px_rgba(201,100,66,0.2)]"
        >
          {isUnsubscribeFlow ? '重新订阅' : '返回订阅'}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center bg-[var(--surface-sand)] text-[var(--charcoal)] px-6 py-3 rounded-xl text-base font-medium hover:bg-[var(--border)] transition-colors shadow-[0_0_0_1px_var(--ring)]"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
