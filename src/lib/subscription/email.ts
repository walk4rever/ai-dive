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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="margin: 0 0 20px; padding-bottom: 14px; border-bottom: 1px solid #eeede8;">
        <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 10px; line-height: 0;">
              <a href="${siteUrl}" style="text-decoration: none; display: inline-block;">
                <img src="${siteUrl}/logo.png" width="24" height="24" alt="AI-DIVE" style="display: block; border: 0; outline: none; border-radius: 5px;" />
              </a>
            </td>
            <td style="vertical-align: middle;">
              <a href="${siteUrl}" style="font-size: 15px; font-weight: 700; color: #141413; letter-spacing: -0.2px; text-decoration: none; font-family: 'Noto Serif SC', Georgia, serif;">
                AI-DIVE
              </a>
            </td>
          </tr>
        </table>
      </div>
      <h1 style="font-size: 26px; line-height: 1.35; margin: 0 0 16px; color: #141413; font-family: 'Noto Serif SC', Georgia, serif;">
        ${post.title}
      </h1>
      <p style="font-size: 15px; line-height: 1.8; color: #4d4c48; margin: 0 0 24px;">
        ${post.excerpt || '新内容已发布，点击下方按钮阅读全文。'}
      </p>
      <a href="${postUrl}" style="display: inline-block; padding: 11px 22px; background: #c96442; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
        阅读全文 →
      </a>
      <p style="font-size: 12px; color: #87867f; line-height: 1.7; margin: 32px 0 0; border-top: 1px solid #eeede8; padding-top: 16px;">
        ${recipient.name ? `${recipient.name}，` : ''}你收到这封邮件，是因为你订阅了 AI-DIVE。
        如不再希望接收更新，可
        <a href="${unsubscribeUrl}" style="color: #5e5d59; text-decoration: underline;">点击退订</a>。
      </p>
    </div>
  `
}
