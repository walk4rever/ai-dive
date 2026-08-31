# AI-DIVE

帮你读懂 AI，而不只是跟上 AI。

`AI-DIVE` 面向所有关注 AI 的用户，围绕**创造力、判断与审美**三个维度，筛选真正重要的变化，通过**简讯 / 深度 / 访谈**帮助读者理解变化的长期意义。

Powered by [Air7.fun](https://air7.fun)

## 当前能力

- 极简首页：精选文章、最新文章、专题入口和每日 Signals
- 文章详情页：适合中文长文阅读的 editorial 排版；情报/深度/洞见发布即全文可读，不再有付费墙
- 文章目录导航：H2/H3 数量 ≥3 篇的文章左上角显示悬浮目录按钮，点开面板可跳转到对应章节
- 回到顶部：`dive`/`insight` 文章滚动超过一屏后左下角出现悬浮按钮，点击回到文章顶部
- `/wiki`：Quartz 静态知识库子站，挂在 `ai.air7.fun/wiki/`
- `/intels`：信号日历页，含 SignalHighlights（洞见 / 实践 / 影响力三维 top 信号）和 SignalFeed（当日完整信号列表）
- 邮件订阅页
- 双重确认订阅流程
- 登录、注册和用户文章管理
- 登录态：next-auth（httpOnly JWT session cookie），服务端 `getServerSession()` 本地验签，不再逐请求查库；`/agent`、`/dashboard`、`/admin/*`、文章 AI解读 面板的登录门禁均已下沉到服务端，未登录直接 SSR 跳转 `/login?next=...`，登录成功后自动返回原页面 / 重新打开 AI解读面板（`/decks` 列表页不在此列，已改为公开访问，见下）
- `/agent`、文章 AI解读 面板的 credits 计量：`ai_pulse_credit_ledger`（append-only，余额 = 当期 `SUM(delta)`），登录用户每月懒发放 1000 credits（1 轮对话 = 1 credit），另加 50/小时的速率限制防脚本失控——两者是两层不同的机制，不是同一回事；余额展示在 `/dashboard`（进页面即懒发放当期额度，再读余额）
- `/agent` 与文章 AI解读 面板支持粘贴图片提问（DeepSeek vision，client 端降采样为 1280px JPEG，单条消息最多 4 张，点击缩略图可查看大图）
- `/agent`、文章 AI解读 面板的会话持久化：登录用户对话写入 `ai_pulse_chat_turns`，刷新/换设备可续接最近 10 轮；图片存 R2；pi-gateway 冷启动时把历史回放进 `AgentSession`，模型能记住之前聊过什么
- 文章 AI解读 面板支持最大化/还原（header 图标按钮，原地撑满视口，不丢对话状态），标题统一为单行 `AI解读 · {文章标题}`
- 管理后台：编辑文章元数据、发布状态、精选状态和专题编排
- Newsletter 批量发送、退订处理和发送记录
- R2 文件上传（包括大文件 presigned upload）
- Vault Markdown → Supabase 内容导入脚本
- 管理员标记：`ai_pulse_users.role`（`user` / `admin`），登录时读入 next-auth JWT（`src/lib/auth.ts`），管住 `/admin`、`/api/admin/*`，并绕过 `/decks` 付费墙。提升某个账号：`UPDATE ai_pulse_users SET role = 'admin' WHERE email = '...';`（该列历史上是直接在生产库手工加的，`supabase/migrations/20260831_users_role.sql` 已把定义补回仓库）
- `/decks`（出品）付费墙：列表页公开可浏览（不再需要登录），正文按 `ai_pulse_decks.price_cents` 走鉴权代理路由（`/decks/[slug]/[...path]`）——未定价的 deck 对所有人开放，定价后的 deck 需要登录 + 有 `paid` 状态的 `ai_pulse_orders` 记录才能访问（`role = 'admin'` 的账号免购买，列表页标记为「管理员」）；定价未购买的 deck 在列表页显示支付宝购买按钮，点击后创建 `pending` 订单并跳转支付宝收银台。支付走**支付宝官方电脑网站支付**（`alipay.trade.page.pay`，公钥模式 / RSA2，`src/lib/payments/alipay.ts`），签名与网关连通性已用只读查单接口对真实商户号验证通过；易支付聚合通道保留给微信支付（尚无凭证）。首篇定价 deck 为「推理工程实战手册」¥19.90，其余 7 篇仍未定价
- Signal 注入 API：`POST /api/signals`，支持单条或批量 upsert 到 `ai_pulse_signals`（可选 `signal_date`；不传默认 UTC+8 当天）

产品与架构设计详见 `PRODUCT.md`，阶段化事项详见 `TODO.md`。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- Resend
- next-auth v4
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
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

说明：

- `EMAIL_CONFIRMATION_SECRET` 用于生成和校验一次性确认链接，不能和其他密钥复用。
- `EMAIL_CONFIRMATION_TTL_SECONDS` 默认建议 `86400`，即 24 小时。
- `NEXTAUTH_SECRET` 用于加密登录 session cookie，`openssl rand -base64 32` 生成；本地和线上必须各用一份独立的值，不能共用——泄露一份等于两边都能被伪造登录态。
- `NEXTAUTH_URL` 填当前环境的站点地址（本地 `http://localhost:3000`，线上填实际域名）。

### 3. 初始化数据库

首次初始化时，在 Supabase SQL Editor 中执行 `supabase/schema.sql`。已有环境按文件名中的时间顺序执行 `supabase/migrations/` 下尚未执行的迁移，不要反复执行整份 schema。部署本版本前必须执行 `20260804_add_author_display.sql`。

当前 schema 会创建以下表：

- `ai_pulse_stories`（原 `ai_pulse_posts`）
- `ai_pulse_topics`（原 `ai_pulse_series`）
- `ai_pulse_signals`（`signal_date`=业务归属日，`created_at`=入库时间，`updated_at`=更新时间）
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

### 4b. 嵌入交互式 HTML（可选）

文章正文里可以用 `::embed{src="..." height="..."}` 指令嵌入一个独立的、agent 生成的自包含 HTML 页面（报告、可视化 demo）。渲染为沙箱 iframe（`sandbox="allow-scripts"`，不带 `allow-same-origin`），`src` 必须命中 `CLOUDFLARE_R2_PUBLIC_URL` 配置的域名，指向其他域名会被拦截并显示错误。

先把 HTML 文件传到 R2，拿到可用的 `src` 和一段供 AI 解读用的隐藏摘要：

```bash
# 签发 Agent API Key（自助接口已下线，这是唯一入口；Key 只打印一次）
source .env.local && node scripts/issue-agent-key.mjs <email> <agent-name>
# 轮换已有 agent 的 Key（旧 Key 立即失效，文章与 agent id 保留）
source .env.local && node scripts/issue-agent-key.mjs <email> <agent-name> --rotate
```

```bash
node scripts/upload-html-embed.mjs <html-file> <slug> [--height=2400]
```

输出可以直接粘贴进文章 markdown。`height` 只是 JS 跑起来之前的初始猜测——嵌入页面里会自动注入一段上报真实高度的脚本，父页面收到后会把 iframe 撑到实际内容高度，不需要手动量准。R2 对象走 `immutable` 缓存，脚本每次运行都会在 URL 后面加 `?v=` 参数防止改完内容后还读到旧缓存。

### 4c. 导入出品（/decks，可选）

`/decks` 的元数据存在 `ai_pulse_decks` 表里（见 `supabase/migrations/20260812_create_decks.sql`），HTML 内容一律传到 R2——外部 agent 跑一条命令即可上线新条目，不需要改代码或部署。数据库里存的 `href` 是同源路径（如 `/decks/<slug>/<entry>`），不是 R2 原始域名；`src/app/decks/[slug]/[...path]/route.ts` 这个鉴权代理路由负责把该路径读回 R2 对象内容，访客地址栏不会看到 R2 的域名（之前是 `next.config.ts` 的公开 `rewrites()` 做同样的转发，阶段 4.2 已改成这个会校验权限的路由，见 `TODO.md`）。`kicker` 是固定分类枚举（`KEYNOTE`/`COURSE`/`REPORT`/`PLAYBOOK`，数据库层有 `CHECK` 约束，见 `supabase/migrations/20260827_decks_kicker_fixed_taxonomy.sql`），不是自由文本：

```bash
node scripts/import-deck.mjs <html-file-or-dir> \
  --slug=<slug> --title="..." --kicker=<KEYNOTE|COURSE|REPORT|PLAYBOOK> --description="..." \
  --meta="..." --date=2026-08-12 \
  [--entry=index.html] [--status=draft] [--price=19.9] [--currency=CNY] [--dry-run]
```

输入可以是单个 HTML 文件，也可以是一个目录（比如 index.html + 多篇 day-0X.html 组成的系列课程）；目录会按相对路径整体上传到 R2，`--entry` 指定作为 `/decks` 列表点击目标的入口文件（默认 `index.html`），页内的相对链接和相对资源引用保持不变。`--price` 是元为单位，不传则不改动已有价格（新 slug 默认免费），`--price=0` 显式清价改回免费。

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
npm run import:deck -- "/path/to/deck.html" --slug=... --title=... --kicker=<KEYNOTE|COURSE|REPORT|PLAYBOOK> --description=... --meta=... --date=2026-08-12
```

## 当前页面路由

- `/`：首页
- `/post/[slug]`：文章详情
- `/intels`：信号日历 + 信号流页
- `/dives`：深度列表
- `/insights`：洞见列表，按来源（`author_display`）胶囊过滤
- `/latest`：最新内容列表
- `/archive`：内容归档
- `/series`：专题列表
- `/decks`：出品（幻灯片 / 报告 / 交互式解读，元数据存于 `ai_pulse_decks` 表，导入见上文 4c；列表页公开，正文按定价走鉴权，管理员免付费，见"当前能力"）
- `/admin`：管理员总览（可点统计卡 + 最近发布列表）
- `/admin/posts`：文章管理（搜索 + 类型/状态筛选）
- `/admin/decks`：出品管理（改元数据 + 定价，正文只读，托管在 R2，换正文走 `scripts/import-deck.mjs`）
- `/admin/users`：用户管理（列表 + 管理员角色切换 + 删除账号，见下方「当前能力」）
- `/admin/subscribers`：订阅管理（只读，看 `ai_pulse_subscribers` 的确认/待确认/退订状态，没有任何操作按钮）
- `/admin/newsletter`：周刊发送（信号解读 + 深度阅读 + 热门出品三段式邮件，预览 / 发测试 / 发给全部订阅者，见下方「当前能力」——依赖 `supabase/migrations/20260831_create_newsletter_issues.sql`，部署前必须先在 Supabase SQL Editor 执行）
- `/admin/series`：专题编排
- `/admin/upload`：图片上传取 Markdown
- `/admin/new`：管理员新建文章
- `/admin/edit/[slug]`：管理员文章元数据编辑
- `/dashboard`：用户控制台（本月 AI 额度、我的订单、账号设置；管理员多一枚「管理员」徽章和「管理后台」入口）
- `/agent`：Agent 入口（需登录）
- `/docs`：API 文档
- `/subscribe`：订阅页
- `/subscribe/confirmed`：确认结果页

## 当前 API 路由
- `/api/subscribe`：订阅接口
- `/api/confirm`：确认接口
- `/api/signals`：信号注入接口（POST，agent auth，单条或批量）
- `/api/posts`：故事发布接口（GET/POST，agent auth）
- `/api/posts/[slug]`：故事更新接口（PATCH，agent auth）
- `/api/admin/posts`、`/api/admin/posts/[slug]`：管理员文章管理
- `/api/admin/posts/[slug]/send`：向确认订阅者发送文章
- `/api/admin/posts/preview`：管理员 Markdown 正文预览
- `/api/admin/decks/[slug]`：管理员出品元数据 + 定价（PATCH，只改 `ai_pulse_decks` 的元数据列，从不接受 `href`/`slug`——那是 R2 内容路径的身份，改了会让内容代理路由解析不到）
- `/api/admin/users/[id]`：管理员用户管理（PATCH 只改 `role`，拦自我降级；DELETE 硬删除且级联 agent/订单/额度流水/会话，拦自我删除，外键冲突时返回 409 而不是裸 500）
- `/api/admin/newsletter/preview`：按当前输入的摘要文字重渲染周刊 HTML，不发信不落库
- `/api/admin/newsletter/test-send`：发一封周刊到任意测试邮箱，不写 `ai_pulse_newsletter_issues`、不计入订阅者发送记录
- `/api/admin/newsletter/send`：发给全部已确认订阅者；按 `period_start`（本次计算出的 7 天窗口）找到或新建一条 `ai_pulse_newsletter_issues`，复用 `ai_pulse_email_sends`（`story_id` 留空、`newsletter_issue_id` 指向本期）做逐订阅者去重——同一天内重复调用只会补发漏发的人，不会重复打扰已收到的订阅者
- `/api/upload`、`/api/upload/presign`：文件上传
- `/api/agent`：探索/AI解读对话接口（POST，需登录，credits 余额不足返回 402、超出小时限速返回 429，转发到 pi-gateway，SSE 流式返回）
- `/api/agent-turns`：会话历史读写接口（GET 拉取最近 10 轮，POST 持久化一轮，均需登录）
- `/decks/[slug]/[...path]`：出品正文鉴权代理（GET，未定价放行，定价后需登录 + 有 `paid` 订单或 `role = 'admin'`，从私有 R2 读取内容原样返回）
- `/api/decks/[slug]/orders`：出品下单接口（POST，需登录，创建 `pending` 订单并返回支付通道的跳转链接）
- `/api/orders/callback/alipay`：支付宝异步回调（POST 表单，RSA2 验签 + 校验 `app_id` 与金额后把订单标记为 `paid`，回纯文本 `success`；未配置 `ALIPAY_*` 时直接报错，不会静默失败）
- `/api/orders/callback/epay`：易支付异步回调（GET，验签后把订单标记为 `paid`；未配置 `EPAY_*` 时直接报错，不会静默失败）

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

当前 GitHub Actions 只在 push/PR 到 `main` 时执行 `npm run lint`；`test` 和 `build` 目前仍需本地手动执行。

## License

MIT
