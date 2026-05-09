# AI-DIVE

帮你读懂 AI，而不只是跟上 AI。

`AI-DIVE` 面向所有关注 AI 的用户，围绕**创造力、判断与审美**三个维度，筛选真正重要的变化，通过**简讯 / 深度 / 案例 / 访谈**帮助读者理解变化的长期意义。

Powered by [Air7.fun](https://air7.fun)

## 当前能力

- 极简首页：单一文章列表（深度 / 案例 / 投资 / 播客混排）
- 文章详情页：适合中文长文阅读的 editorial 排版
- `/wiki`：Quartz 静态知识库子站，挂在 `ai.air7.fun/wiki/`
- `/intel`：信号日历页，含每日 overview + 关键词，以及 SignalHighlights（洞见 / 实践 / 影响力三维 top 信号）和 SignalFeed（当日完整信号列表）
- 邮件订阅页
- 双重确认订阅流程
- 草稿 / 已发布内容工作流
- 系列管理（管理员）：创建系列、把文章加入多个系列、设置系列内顺序
- Vault Markdown → Supabase 内容导入脚本
- 付费内容占位式 paywall
- Signal 注入 API：`POST /api/signals`，支持单条或批量 upsert 到 `ai_pulse_signals`

产品与架构设计详见 `PRODUCT.md`，阶段化事项详见 `TODO.md`。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- Resend
- Vitest

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，并填入真实值：

```bash
cp .env.example .env.local
```

必填变量：

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_NAME`
- `RESEND_FROM_EMAIL`
- `EMAIL_CONFIRMATION_SECRET`
- `EMAIL_CONFIRMATION_TTL_SECONDS`

说明：

- `EMAIL_CONFIRMATION_SECRET` 用于生成和校验一次性确认链接，不能和其他密钥复用。
- `EMAIL_CONFIRMATION_TTL_SECONDS` 默认建议 `86400`，即 24 小时。

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql`。

当前 schema 会创建以下表：

- `ai_pulse_stories`（原 `ai_pulse_posts`）
- `ai_pulse_topics`（原 `ai_pulse_series`）
- `ai_pulse_signals`
- `ai_pulse_distributions`
- `ai_pulse_subscribers`
- `ai_pulse_email_sends`

### 4. 导入内容（可选）

当前内容源采用 Vault Markdown + frontmatter。导入单篇文章：

```bash
npm run import:post -- "/absolute/or/relative/path/to/article.md"
```

例如：

```bash
npm run import:post -- "/Users/rafael/R129/Vault/AI-DIVE/Harness系列-篇1-什么是Harness.md"
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 <http://localhost:3000>。

## 常用脚本

```bash
npm run dev
npm run lint
npm run test
npm run test:coverage
npm run build
npm run import:post -- "/path/to/article.md"
```

## 当前关键路由

- `/`：首页
- `/post/[slug]`：文章详情
- `/intel`：信号日历 + 信号流页
- `/analysis`：深度分析列表
- `/cases`：案例列表
- `/invest`：投资列表
- `/podcast`：播客列表
- `/series`：专题列表
- `/subscribe`：订阅页
- `/subscribe/confirmed`：确认结果页
- `/api/subscribe`：订阅接口
- `/api/confirm`：确认接口
- `/api/signals`：信号注入接口（POST，agent auth，单条或批量）
- `/api/posts`：故事发布接口（GET/POST，agent auth）
- `/api/posts/[slug]`：故事更新接口（PATCH，agent auth）

## 当前确认流程

1. 用户在 `/subscribe` 提交邮箱。
2. 服务端写入或更新 `ai_pulse_subscribers`。
3. 系统生成带过期时间的一次性确认链接并发送邮件。
4. 用户点击 `/api/confirm`。
5. 服务端校验签名、过期时间、当前有效 nonce。
6. 校验通过后写入 `confirmed_at`，并清空 nonce，避免重复使用。

## 验证

本地交付前建议至少运行：

```bash
npm run lint
npm run test
npm run build
```

## License

MIT
