import Link from 'next/link'

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>
}

export default async function VerifyPage({ searchParams }: Props) {
  const { success, error } = await searchParams

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <p className="kicker mb-6">验证成功</p>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            邮箱已验证，现在可以登录了。
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 text-sm font-medium hover:opacity-80 transition-opacity"
            >
              前往登录 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const errorMessages: Record<string, string> = {
    expired: '验证链接已过期，请重新注册。',
    invalid: '验证链接无效，请检查邮件或重新注册。',
    server: '服务暂时不可用，请稍后重试。',
  }

  const errorMsg = errorMessages[error ?? ''] ?? '验证失败，请重新注册。'

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <p className="kicker mb-6">验证失败</p>
        <p className="text-[var(--muted)] text-sm leading-relaxed">{errorMsg}</p>
        <div className="mt-8">
          <Link href="/register" className="kicker hover:text-[var(--foreground)] transition-colors">
            重新注册 →
          </Link>
        </div>
      </div>
    </div>
  )
}
