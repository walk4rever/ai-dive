import { buildUnsubscribeUrl } from '@/lib/subscription/links'

interface SendablePost {
  slug: string
  title: string
  excerpt: string
}

interface SubscriberRecipient {
  id: string
  email: string
  name: string | null
}

export function buildPostEmailHtml({
  post,
  recipient,
  siteUrl,
  secret,
}: {
  post: SendablePost
  recipient: SubscriberRecipient
  siteUrl: string
  secret: string
}) {
  const postUrl = `${siteUrl}/post/${post.slug}`
  const unsubscribeUrl = buildUnsubscribeUrl({
    email: recipient.email,
    subscriberId: recipient.id,
    secret,
    siteUrl,
  })

  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 12px; color: #777; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 16px;">
        AI-DIVE
      </p>
      <h1 style="font-size: 28px; line-height: 1.3; margin: 0 0 16px; color: #111;">
        ${post.title}
      </h1>
      <p style="font-size: 16px; line-height: 1.8; color: #444; margin: 0 0 24px;">
        ${post.excerpt || '新内容已发布，点击下方按钮阅读全文。'}
      </p>
      <a href="${postUrl}" style="display: inline-block; padding: 12px 22px; background: #111; color: #fff; text-decoration: none; border-radius: 999px; font-size: 14px; font-weight: 600;">
        阅读全文
      </a>
      <p style="font-size: 12px; color: #999; line-height: 1.7; margin: 32px 0 0;">
        ${recipient.name ? `${recipient.name}，` : ''}你收到这封邮件，是因为你订阅了 AI-DIVE。
        如不再希望接收更新，可
        <a href="${unsubscribeUrl}" style="color: #666;">点击退订</a>。
      </p>
    </div>
  `
}
