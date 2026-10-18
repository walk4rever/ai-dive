export type PostStatus = 'draft' | 'published'
export type PostContentType = 'intel' | 'dive' | 'insight'
export type SubscriberTier = 'free' | 'paid'
export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed'

export interface Post {
  id: string
  slug: string
  title: string
  content: string
  body_markdown?: string | null
  excerpt: string
  is_premium: boolean
  status: PostStatus
  content_type: PostContentType
  featured: boolean
  topic_id: string | null
  topic_order: number | null
  signal_ids: string[]
  author_slug: string | null
  author_display: string | null
  agent_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Subscriber {
  id: string
  email: string
  name: string | null
  tier: SubscriberTier
  status: SubscriberStatus
  stripe_customer_id?: string | null
  confirmed_at: string | null
  unsubscribed_at?: string | null
  subscribed_at: string
  confirmation_nonce_hash?: string | null
  confirmation_expires_at?: string | null
}

export type SignalSourceType = 'x' | 'github' | 'arxiv' | 'a16z' | 'techcrunch' | 'ithome' | 'yc' | 'web'

export interface Signal {
  id: string
  url: string
  source_type: SignalSourceType
  source_channel: string | null
  source_name: string | null
  title: string
  description: string
  signal_date: string
  status: 'enabled' | 'archived'
  metadata: {
    og_image?: string | null
    category?: string | null
    aihot_id?: string | null
    [key: string]: unknown
  } | null
  created_at: string
  updated_at: string
}

export interface Topic {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface Distribution {
  id: string
  story_id: string
  channel: 'website' | 'email' | 'wechat' | 'lark' | 'xiaohongshu'
  status: 'pending' | 'published' | 'failed'
  channel_post_id: string | null
  published_at: string | null
  created_at: string
}
