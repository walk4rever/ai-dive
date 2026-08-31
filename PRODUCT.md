# AI-DIVE

## 1. 产品定位

`AI-DIVE` 是一个面向 AI 工程师的研究型媒体产品。

它不追求覆盖所有 AI 新闻，而是通过编辑判断筛选真正重要的变化，并通过周刊与深度专题帮助读者理解这些变化的长期意义。

一句话定位：

> 不是追所有 AI 新闻，而是解释真正重要的变化。

---

## 2. 目标读者

`AI-DIVE` 的核心读者是：

- 正在使用 AI 写代码的工程师
- 关心模型、工具链、agent workflow 与工程实践变化的独立开发者
- 希望减少信息噪音、提高判断效率的 AI 实践者

这个产品不是写给泛 AI 爱好者，也不是写给纯研究读者，更不是写给投资视角的行业观察者。

它优先服务一类具体读者：

> 每天在用 Claude Code、Cursor、Codex 或其他 AI 编程工具，但没有足够时间跟踪全部变化、又需要高质量判断的人。

---

## 3. 内容结构

`AI-DIVE` 采用“双引擎”结构：

- **周刊**：负责每周筛选与判断
- **深度专题**：负责认知升级与长期沉淀

整体原则是：

> 情报负责每日信号，深度负责产品/技术/案例的认知升级，洞见负责人与公司的商业判断，投资与播客拓展内容维度。

### 3.1 周刊

周刊不是新闻搬运，也不是全量汇总。

周刊的目标是：

- 从一周内大量 AI 相关新闻中筛出真正重要的变化
- 给出明确判断，而不是只做客观罗列
- 帮读者节省信息处理成本

周刊默认结构：

1. **本周一个判断**
2. **本周 3 件事**
3. **速览**
4. **原始链接 / 延伸阅读**

周刊的核心标准不是“覆盖多少”，而是：

- 读者能否记住这周最重要的一个判断
- 读者能否理解“这件事对我意味着什么”

### 3.2 深度专题

深度专题承担品牌锚点和长期内容资产的职责。

它通常具备这些特征：

- 围绕一个明确主题展开
- 可以是单篇深度文，也可以是系列化内容
- 强调结构、判断和长期传播价值
- 适合作为未来付费内容与品牌代表作的基础

例如：`Harness` 系列就是典型的深度专题。

### 3.3 内容类型一览

| 类型 | 路由 | 说明 |
|------|------|------|
| `intel` | `/intels` | 每日 AI 信号精选，日历导航 |
| `dive` | `/dives` | 深度分析（产品/技术/案例），认知升级 |
| `insight` | `/insights` | 围绕人 / 公司的洞见，商业模式与外部播客 |

当前应用的文章内容类型只有 `intel`、`dive`、`insight`。投资和播客仍属于产品方向描述，尚未对应独立路由或内容类型。

---

## 4. 内容生产系统

`AI-DIVE` 的内容生产以 Markdown 为源头。

写作发生在 `Vault/AI-DIVE` 中，文章通过 frontmatter 提供结构化元数据，再由导入脚本同步到 `AI-DIVE` 的内容库中。

这意味着：

- Markdown 是内容源
- frontmatter 是结构化元数据源
- 网站、邮件、微信公众号共享同一份内容基础

原则上，不应该在“写稿之外”重复维护另一套内容元信息。

### 4.1 内容源与分发原则

内容生产与分发遵循以下原则：

1. **写作在 Vault 中完成**
2. **frontmatter 是元数据唯一事实源**
3. **发布采用手动触发导入**
4. **网站、邮件、微信尽量复用同一份内容源**
5. **先保证内容一致性，再优化自动化程度**

第一版发布流程不追求全自动，而是追求稳定、可控、可 debug。

### 4.2 Frontmatter 规范

每篇文章应包含 frontmatter。推荐字段如下：

```yaml
title: 标题
slug: 可选但推荐
date: 2026-03-30
content_type: intel | dive | insight | invest | podcast
author: R129
source_type: editorial | guest | syndicated
status: draft | published
featured: false
series_slug:
excerpt:
tags: []
source_url:
is_premium: false
---
```

字段说明：

- `title`：文章标题
- `slug`：URL 标识，推荐显式填写
- `date`：发布日期
- `content_type`：内容类型，固定为 `intel` / `dive` / `insight` / `invest` / `podcast`
- `author`：作者展示名称；导入时生成稳定的 `author_slug`，同时写入 `author_display`
- `source_type`：内容来源，当前默认 `editorial`
- `status`：发布状态，使用 `draft` 或 `published`
- `featured`：是否作为首页主打内容
- `series_slug`：所属系列，例如 `harness`
- `excerpt`：用于首页、订阅和摘要展示的手写摘要
- `tags`：文章标签
- `source_url`：原始来源链接，适合周刊或评述类文章
- `is_premium`：历史字段，创建接口仍接受，但文章详情页已不再读取——情报/深度/洞见发布即全文可读，不做付费墙

### 4.3 Slug 与元数据规则

Slug 规则如下：

1. 优先使用 frontmatter 中显式定义的 `slug`
2. 如果没有 `slug`，则从标题自动生成
3. 内容一旦发布，slug 尽量不再修改

建议：

- 周刊可以使用带日期的稳定 slug
- 深度文章尽量使用简短、清晰、可复用的 slug
- 系列内容的 slug 风格应保持统一

摘要规则：

- 优先使用手写 `excerpt`
- 不建议完全依赖正文自动截断
- 摘要应体现判断，而不是只做内容复述

### 4.4 发布工作流

第一版发布工作流如下：

```text
Vault Markdown
→ 补齐 frontmatter
→ 手动触发导入脚本
→ 同步到 AI-DIVE
→ 再分发到微信 / 邮件
```

具体原则：

- 不使用“保存即发布”
- 不依赖自动监听文件变化
- 先通过手动发布形成稳定流程
- 发布动作应可重复执行、可验证结果

按内容类型，工作流略有区别：

#### 周刊

1. 收集一周素材
2. 先写“本周一个判断”
3. 选出本周 3 件事
4. 其余内容压缩为速览
5. 补齐 frontmatter
6. 手动导入并发布

#### 深度专题

1. 明确一个核心命题
2. 完成文章写作
3. 如果属于系列，填写 `series_slug`
4. 补齐 frontmatter
5. 手动导入并发布

---

## 4.5 Signal Pipeline

Signal Pipeline 是内容生产的上游层，负责从外部聚合器摄取原始信号，评分筛选后路由给专项 agent 生产 Story。

### 流向

```text
外部聚合器（aihot / HN / GitHub / arXiv）
→ ai_pulse_signals（raw）
→ 策展 agent 评分与筛选
→ ai_pulse_signals（selected）
→ 专项 agent（GitHub agent / arXiv agent / ...）
→ ai_pulse_stories
→ ai_pulse_distributions
```

当前主要摄取源是 `aihot.virxact.com`。Agent 自行从 aihot 拉取已选信号，通过 `POST /api/signals` 批量注入到 `ai_pulse_signals`。

`POST /api/signals` 的时间语义：

- `signal_date`：信号业务归属日（支持补录历史信号）
- `created_at`：信号入库时间
- `updated_at`：信号最近一次修改时间

### 三维评分

策展 agent 对每条信号打三个维度的分（0-10）：

| 维度 | 字段 | 判断依据 |
|------|------|---------|
| 洞见 | `insight` | 原创性 / 重大发布 / 真知灼见 |
| 实践 | `actionable` | 经验分享 / 案例 / 有可运行代码 |
| 影响力 | `influence` | AI 热点 / 覆盖面 / 紧迫程度 |

高分信号路由给对应专项 agent 生产 Story；低分信号归档或丢弃。

### /intels 页信号展示

`/intels` 页消费 `ai_pulse_signals`，以日历为导航，展示：

- **SignalHighlights**：每个维度得分最高的信号各一张卡片（共三张）
- **SignalFeed**：当日完整信号列表，随日历点击切换（URL 参数 `?d=YYYY-MM-DD`）

---

## 5. 信息架构

首页先按内容类型组织，而不是先按作者或系列组织。

原因很简单：

- 新读者先需要理解“这里有什么内容”
- 再理解“这些内容属于哪个系列或作者”

当前首页实际结构为：

1. Hero：一句话定位与副标题
2. Signals 日历与当日精选
3. 精选文章
4. 专题入口
5. 最新文章
6. 归档入口

### 5.1 首页结构

首页建议包含以下模块：

#### Hero
- 一句话定位
- 简短副标题
- Signals 日历与当日精选入口

#### 精选
- 最多展示三篇标记为精选的 `dive` / `insight` 内容

#### 专题
- 展示已有专题及文章数量
- 通过 `/series` 进入专题编排和阅读

#### 最新
- 展示最近发布的文章
- 通过 `/archive` 查看完整归档

### 5.2 内容类型优先于系列/作者

现阶段，类型优先于系列和作者。

也就是说：

- 首页先让用户理解 `intel / dive / insight / invest / podcast`
- 系列和作者作为第二层信息补充
- 不把首页做成“作者墙”或“系列目录”

随着深度内容增多，可以逐步强化系列页和作者页，但不应成为第一阶段的主结构。

---

## 6. 数据模型方向

现阶段的数据模型遵循”轻量预留”原则：

- 先在文章层表达内容类型、系列、作者、来源等语义
- 不急于建立复杂 CMS
- 在业务明确后，再逐步抽离 `topics`、`authors` 等实体

当前核心表：

- `ai_pulse_stories`：内容文章（原 `ai_pulse_posts`）
- `ai_pulse_topics`：话题 / 系列（原 `ai_pulse_series`，junction 表已废弃，stories 通过 `topic_ids uuid[]` 关联）
- `ai_pulse_signals`：从外部聚合器（aihot、HN、GitHub、arXiv）摄取的原始信号，含三维评分（洞见 / 实践 / 影响力 0-10）
- `ai_pulse_distributions`：渠道发布记录（website / email / wechat / lark / xiaohongshu）
- `ai_pulse_subscribers`：邮件订阅用户
- `ai_pulse_email_sends`：邮件发送日志（`story_id` 关联 stories，原为 `post_id`）

作者字段约定：`author_slug` 是稳定机器标识，`author_display` 是展示名称。迁移文件 `20260804_add_author_display.sql` 会为现有文章回填展示名称并规范化 slug。

数据流向：**Signal → Story → Distribution**。

长期上，系列和作者应成为独立资产，但第一阶段不需要过度工程化。

---

## 7. 当前系统能力

### 7.1 已实现能力

- 首页展示已发布文章
- 文章详情页：情报/深度/洞见发布即全文可读，不做付费墙；文章目录导航（H2/H3 数量 ≥3 时左上角悬浮按钮，点开面板跳转章节）；`dive`/`insight` 文章滚动超过一屏后左下角显示"回到顶部"悬浮按钮
- 邮件订阅页
- 双重确认订阅
- 独立的订阅确认结果页
- Next.js + Supabase + Resend 的单仓库实现
- Signal 注入 API（`POST /api/signals`），支持单条或批量（上限 100）upsert 到 `ai_pulse_signals`，冲突键为 `url`
- `ai_pulse_signals` 三维评分 schema（insight / actionable / influence 0-10），`scripts/score-signals-v1.mjs` 规则打分，PM2 定时任务每小时/每晚自动跑
- `ai_pulse_signals` 时间语义：`signal_date`（归属日）/ `created_at`（入库）/ `updated_at`（更新）
- `/intels` 页 SignalHighlights（三维 top 信号卡片）与 SignalFeed（日历驱动信号列表）
- 后台管理端结构（2026-08-31 route group 拆分，P1）：`src/app/(admin)/admin/` 是独立的 Next.js route group，`(admin)/layout.tsx` 集中做一次 `session.user.role !== 'admin'` 检查（此前每个 admin 页面各自重复一遍），再套 `AdminShell`（左侧竖导航，桌面 `md:grid-cols-[160px_1fr]`，移动端横向滚动 tab，同 `NavLinks` 的 active-link 判定思路）。公开站点同理拆进 `(site)/`，两个 group 各自的 `layout.tsx` 提供各自的 chrome，根 `layout.tsx` 收窄成只剩 `<html><body><Providers>`（`Providers`/`SessionProvider` 必须留在根层，因为站点导航和后台都调 `useSession()`/`signOut()`）；站点 chrome 被提炼成 `SiteChrome` 组件，因为 Next.js 的 not-found/error 边界只会被它物理嵌套所在的 layout 包裹——一个完全不匹配任何路由的路径（不会进入 `(site)/` 子树）必须靠根级 `app/not-found.tsx`/`app/error.tsx` 兜底，这两个文件手动 `<SiteChrome>` 包一层；`(site)/` 内部的 `notFound()`（如 `/post/[slug]`）则走 `(site)/not-found.tsx`，被 `(site)/layout.tsx` 自动包裹，两处共享 `NotFoundContent`/`ErrorContent` 组件避免内容长期维护出现两份漂移
- 后台页面按运营对象拆分：`/admin` 总览（可点统计卡跳转到 `/admin/posts?filter=pending|featured` 直接命中筛选结果 + 最近发布列表）、`/admin/posts` 文章管理（标题/slug 搜索 + 类型/状态筛选，「待发 Newsletter」= 已发布且从未出现在 `ai_pulse_email_sends` 里的文章，`fetchAdminPostsData()` 在 `src/lib/admin/posts.ts` 里被总览和文章管理两个页面共用，避免同一条统计口径写两遍；删除/精选操作有失败反馈：`res.ok` 判断 + 按行 loading + 错误提示条）、`/admin/series` 专题编排（现在是货真价实的独立路由，只有访问这个 URL 才会挂载和拉取数据——此前用 tab 切换 + 手动挂载时机补丁模拟同样效果，这次route 化之后那个补丁连同 tab 状态一起被删掉了）、`/admin/upload` 图片上传（接入左侧导航，此前是没有任何链接指向的孤儿页）。所有面板统一走 `src/components/ui/Card.tsx`（从控制台提升为通用组件）+ DESIGN.md 的边框/圆角 token，替掉了旧版 `color-mix` 染色背景和裸圆角；删除了零引用死代码 `AdminActions.tsx`（其 `handleLogout` 调用的 `/api/admin/login` 路由早已不存在）
- 用户控制台（`/dashboard`）：本月 AI 额度（数字 + 进度条，月份标签取自 `currentPeriod()`，与余额求和窗口同源）、我的订单（`ai_pulse_orders`，deck 标题批量解析，deck 下架后回落到原始 slug 不丢单）、账号（邮箱只读，用户名 / 密码就地展开修改）；管理员额外显示「管理员」徽章和「管理后台」入口。桌面端两张概览卡并排、订单列表整行铺开，DOM 顺序即移动端顺序（额度 → 订单 → 账号），靠显式 grid 定位换列而不重排标签。只有账号表单和退出按钮是 client 组件，额度与订单纯服务端渲染
- 控制台不再有的两块（2026-08-31 精简）：Agent 创建/轮换/撤销（连同 `/api/agents/*` 路由一并删除，Key 改由 `scripts/issue-agent-key.mjs` 由站点管理员签发）、我的文章（`/my/posts` 及 `/api/my/posts/*` 删除）。`ai_pulse_agents` 表和 `resolveAuthor()` 保留——`/api/posts`、`/api/signals`、`/api/upload` 的 bearer 认证仍然依赖它
- 后台文章工作流（`/admin/new`、`/admin/edit/[slug]`）：所有元数据字段集中在正文编辑器上方（此前正文夹在标题和摘要之间，这次统一挪到最后）；`MarkdownEditor` 的编辑/预览从"编辑区下面再叠一块预览"改成分段 toggle 切换，切到预览时内容没变就复用上次拉取的 HTML、不重复打 `/api/admin/posts/preview`，预览区固定 `h-[32rem] overflow-y-auto`（原来 `min-h` 会随正文一直撑高，保存按钮要翻很久才找得到）；两个表单都加了「取消」按钮（跳回 `/admin/posts`，不保存草稿）；编辑页删除了「发送给订阅者」按钮（对应的 `/api/admin/posts/[slug]/send` 路由本身没删，只是没有 UI 入口了）
- 出品管理（`/admin/decks`、`/admin/decks/[slug]`，2026-08-31 新增）：只能改元数据（标题/类型/描述/元信息/发布日期/状态）和价格，正文永远不出现在表单里——正文托管在 R2，改正文走 `scripts/import-deck.mjs`，`PATCH /api/admin/decks/[slug]` 也在服务端硬性拒绝 `href`/`slug` 这两个字段。价格输入是整数元（如 `19.9`），新写的 `parsePriceYuanToCents()`（`src/lib/decks/access.ts`）把空白和显式填 `0` 都统一转成 `price_cents = NULL`（免费/未定价），不会存成字面意义的"¥0"——这是刻意的：现有付费墙判断只认 `price_cents === null` 才算免费，真存一个 0 会走到"要有 paid 订单"这条路，但支付宝/易支付这些通道对 0 元订单没有正常语义。`formatPrice()` 同一次改动里从"整数元省略小数点"改成了固定两位小数（`¥29` → `¥29.00`），这个函数是 `/decks`、`/dashboard` 订单列表、`/admin/decks` 共用的，所以三处展示一起变了
- 用户管理（`/admin/users`，2026-08-31 新增）：列表（邮箱/用户名/角色/邮箱验证状态/注册时间/本月 AI 额度余额/出品订单数，额度和订单数都是一次性批量查询后在 JS 里按 `user_id` 归并，不是逐用户单独查）+ 管理员角色切换（图标按钮，盾牌图标 filled=管理员）+ 删除账号（垃圾桶图标，`ConfirmDeleteDialog` 要求手动输入目标邮箱才能点亮确认删除，比 `window.confirm()` 更难误触）。删除是硬删除：`ai_pulse_agents`/`orders`/`credit_ledger`/`user_sessions`/`chat_turns` 全部 `ON DELETE CASCADE` 跟着永久消失；`ai_pulse_stories.user_id` 没有级联，所以删除一个以自己身份发过文章的用户会被数据库外键挡住，API 把这种情况识别成 409 而不是甩一个裸 500。两条安全线全部在服务端：不能取消自己的管理员权限、不能删除自己的账号，前端也直接不渲染这两个按钮给自己那一行，不是只在点击后才报错。**角色变更不会让已登录会话立即失效**——`role` 写在登录时签发的 JWT 里，不逐请求查库校验，对方要等下次登录才会应用新角色，页面上有说明
- 订阅管理（`/admin/subscribers`，2026-08-31 新增）：纯只读，看 `ai_pulse_subscribers` 的已确认/待确认/已退订状态和层级，没有任何操作按钮——发邮件仍然走 `/admin/posts` 编辑页原有的发送接口，这个页面只是「看」。`ai_pulse_subscribers` 和 `ai_pulse_users` 是两张完全独立的表，没有外键关联：前者是邮件订阅名单（只需要邮箱，不需要注册），后者是站内登录账号，同一个人的邮箱可能在两边各存一份互不知道对方的记录
- Agent 发布接口（`/api/posts`、`/api/signals`）
- R2 文件上传接口（`/api/upload`、`/api/upload/presign`）
- 系列页（`/series`）
- Newsletter 批量发送（`/api/admin/posts/[slug]/send`）：遍历活跃订阅者、去重已发送、写入 `ai_pulse_email_sends`
- 退订链接与退订处理（`/api/unsubscribe`）
- HTML 消毒（`rehype-sanitize` + `rehype-raw`）
- 数据库迁移体系（`supabase/migrations/`，非单一 `schema.sql`）
- 基础 CI（GitHub Actions，push/PR 到 `main` 时跑 `lint`）
- 登录门禁（`/agent`、`/dashboard`、`/admin/*`、文章 AI解读 面板）：服务端鉴权，未登录直接在 Server Component 里 `redirect('/login?next=...')`，不再有"先渲染空白、客户端 hydrate 完再检查 localStorage 才决定要不要跳转"的闪烁；登录成功后自动返回原页面（AI解读面板会带着 `?open=chat` 标记自动重新打开）——`/decks` 列表页已改为公开访问（阶段 4.2），不再走这条门禁
- 登录态：next-auth（httpOnly、加密 JWT session cookie），服务端 Server Component / Route Handler 用 `getServerSession()` 本地验签即可拿到用户，不再需要每次请求查 `ai_pulse_user_sessions` 表；`/agent` 页面的对话历史在 SSR 阶段直接查出来传给客户端，不再有"渲染空壳、hydrate 后再 fetch 一次"的额外往返
- Agent 对话图片输入（`/agent`、文章 AI解读 面板）：粘贴图片时，`pi-gateway` 仅为携带图片的这一回合切换到 DeepSeek vision 模型（`deepseek-v4-flash-vision-exp`），回复完成后切回默认文本模型
- Agent 会话持久化（`/agent`、文章 AI解读 面板）：登录用户的每一轮对话写入 `ai_pulse_chat_turns`（按 `user_id` + `context_key` 归属，`context_key` 是文章 slug 或字面量 `global`），刷新页面/换设备会重新加载最近 10 轮；图片附件上传到 R2（`users/<userId>/chat/...`），`imageUrls` 随历史一起落库；`pi-gateway` 冷启动（同一 tab-scoped 匿名 session 30 分钟 TTL 过期后的下一次请求）时会用 `SessionManager.appendMessage()` 把这份历史原样灌回 `AgentSession`，让模型"记得"之前聊过什么——历史里的纯图片轮次回放时替换成文字占位符，不重新下载图片
- `/insights` 来源胶囊过滤（`InsightsList.tsx`，客户端组件）：按 `author_display` 分组统计后渲染一排胶囊（含"全部"），点选后仅客户端过滤当前已加载的列表，不发起新请求；胶囊嵌在 `ListPageHeader` 的 `filters` 插槽里，渲染在标题分隔线之上
- Agent 停止按钮真取消（`/agent`、文章 AI解读 面板）：点击停止时，除了 abort 掉浏览器自己的 fetch，还会调用 `POST /api/agent/cancel` 直接告诉 `pi-gateway` 中止那个 session 的生成——不依赖 HTTP 连接断开检测，因为 `/api/agent` 跑在 Vercel 的 Node.js Serverless 运行时上，浏览器断连这件事根本不会传导到正在执行的函数实例，纯连接层面的 abort 会导致 gateway session 卡在"busy"直到原生成自然跑完（`pi-gateway` 自身也在 `server.ts` 把断连检测从 `req.on("close")` 修成了 `res.on("close")`，但这只覆盖常驻进程场景，Vercel 场景仍需这个显式 cancel 端点）
- 文章 AI解读 面板最大化/还原（2026-08-27，从姊妹项目 buffett-tribe 迁移过来的设计）：header 上加了展开/还原图标按钮，点击后 `maximized` state 把面板从停靠/浮层布局切到 `fixed inset-0` 撑满视口，再点还原——纯 CSS/state 切换，不卸载 `AgentChat`，对话内容和输入框草稿不丢；刻意不做"跳转到 `/agent` 页面"这条路，因为 `/agent` 是 `deriveContextKey(undefined)` 的无上下文全局对话页，跳过去会丢文章 slug 对应的 context。同时把面板 header 标题从两行（"AI解读" 标签 + 文章标题）收敛成单行 `AI解读 · {标题}`；`fixed inset-0` 一开始让消息列表和输入框撑满整个视口宽度，行距过长看着不对，随后补了一版让这两处内容改成 `mx-auto max-w-[860px]`，与 `/agent` 探索页的内容列宽对齐（docked/侧栏窄面板下 max-width 本来就大于面板宽度，不生效，行为不变）
- `/agent` 与文章 AI解读 面板对话文字放大（2026-08-27）：正文字号从 `0.83–0.84rem` 统一调到 `0.95rem`，行高从 `1.8/1.85` 收到 `1.7`（字号变大后行距不需要那么松），覆盖用户气泡、AI 回复、流式打字光标、输入框，以及两个对话框共用的 `.agent-md`（渲染 markdown 正文的全局样式）；空状态的建议问题按钮字号保持原样未动
- AI 回复复制按钮（2026-08-27，从姊妹项目 buffett-tribe 迁移过来的设计）：每条已生成完毕的 AI 回复下方新增一个常驻显示的复制图标按钮（不做 hover-only，触屏也能点到），点击复制原始 Markdown 源码而非渲染后的纯文本——粘贴到 Notion/飞书文档等支持 Markdown 的目的地能保留表格、加粗格式；1.5s 内切成 ✓ 反馈后自动还原。流式输出中的最后一条、以及出错的回复不显示该按钮。抽成独立的 `CopyMessageButton`（`src/components/AgentChatCopyButton.tsx`），`AgentChat.tsx` 与 `ArticleChatPanel.tsx` 两处共用，同 `AgentChatImages.tsx` 的既有拆分方式

### 7.2 当前明确未实现

- Vault 内容自动回写（后台正文编辑不会自动同步回 Vault，仍需明确内容事实源）
- 自动化内容导入后台（当前是手动触发的 CLI 脚本，见 4.1 节，这是有意选择而非缺口）
- 打开追踪与点击追踪（`ai_pulse_email_sends.opened_at`/`clicked_at` 字段已预留，未写入）
- 邮件模板管理（当前硬编码单一模板）
- 运营指标面板（订阅数、确认率、打开率、点击率）
- 真正的付费访问控制：情报/深度/洞见已彻底移除 `is_premium` 付费墙（不再读取该字段）；出品（`/decks`）的访问控制、下单、回调、购买按钮均已打通（`src/lib/payments/`、`src/lib/decks/orders.ts`、`src/components/DeckBuyButton.tsx`，阶段 4.2/4.3），支付宝走官方电脑网站支付（真实商户号，签名与网关已验证），微信仍留在易支付聚合通道且无凭证。**尚未跑过一次真实收款**——签名链路验证用的是只读查单接口，真实付款 + 回调解锁这条链路要等首笔真实支付走完才算确认
- credits 额度系统：探索（`/agent`）与 AI 解读目前登录后无限使用，尚无消耗计量、无月度额度、无速率限制
- 作者页
- 精选创作者工作流
- 搜索、标签页、相关文章推荐

### 7.3 访问与付费模型（设计方向，2026-08-27 定稿，未实现）

三层访问模型，公开内容匿名可读，凡是有状态的（AI 对话、购买）一律绑账号：

| 层 | 栏目 | 登录 | 收费 |
|---|---|---|---|
| 公开 | 信号 / 深度 / 洞见 / 专题 | 否 | 免费 |
| 账号 | 探索 + 所有 AI 解读 | 是 | 免费，但计 credits 防爆仓 |
| 付费 | 出品 | 是 | 单篇/系列买断，更新免费 |

要点：

- 出品列表页公开可浏览，但购买前必须先注册登录——不做匿名购买（曾评估用邮箱当身份锚点让未登录用户也能买，但会引入签名链接/cookie 绑定等一整套机制，权衡后放弃，改为更简单的"先注册再买"）
- 邮箱验证墙保持强制，不放开：credits 免费额度按账号发放，验证是防止批量注册刷额度最便宜的一道门槛
- 出品买断是永久权限，与内容版本无关，"更新免费"不需要额外机制
- 出品买断和会员卡额度是两条独立的线，不打包在一起，避免退款/有效期边界变脏
- credits（月度额度，经济模型）和速率限制（短时高频，防滥用）是两层不同的机制，不能互相替代
- 会员卡不支持自动续费（受限于国内个人可开通的支付通道，签不了代扣协议），做成一次性付款的月卡/季卡/年卡

详细落地方案（数据模型、支付通道选型、迁移顺序）见 `TODO.md` 阶段 4。

### 7.4 当前技术约束

- 文章正文保存 Markdown 源（`body_markdown`）和已消毒 HTML（`content`）两种形态
- CI 执行 lint、test、build
- 缺少错误监控与埋点分析

---

## 8. 作者策略

当前业务以编辑部自营内容为主。

也就是说：

- 现阶段主要由内部作者产出内容
- 产品首先验证的是内容判断力和品牌价值
- 不从开放投稿平台起步

但内容模型会预留未来支持精选创作者的能力。

长期方向不是开放平台，而是：

> 编辑部主导 + 精选作者网络

这意味着未来可能出现：

- 邀请制专栏作者
- 系列型 guest essay
- 特定主题的精选合作内容

但这些都建立在编辑标准已经清晰、内容品牌已经稳定之后。

---

## 9. 技术架构

### 9.1 当前技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase Postgres
- Resend
- next-auth v4（JWT session strategy，Credentials provider，登录态是 httpOnly cookie，不落库）

### 9.2 当前系统职责划分

Next.js 当前同时承担：

- Web 渲染层
- API 层
- 与 Supabase / Resend 的集成层
- 内容导入后的展示层

Supabase 当前承担：

- 内容存储
- 订阅用户存储
- 邮件发送日志的预留存储

### 9.3 目录概览

```text
src/
  app/
    api/
      admin/
      agents/
      auth/
      confirm/route.ts
      my/posts/
      posts/
      signals/route.ts
      subscribe/route.ts
      upload/
    admin/
    intels/
    my/posts/
    post/[slug]/page.tsx
    subscribe/page.tsx
    layout.tsx
    page.tsx
  lib/
    subscription/
    supabase/
  types/
supabase/
  schema.sql
scripts/
  import-post.mjs
```

---

## 10. 演进路线

### Phase 1：编辑部媒体成型

目标：

- 双引擎结构跑通
- 周刊形成稳定发布节奏
- 深度专题作为品牌锚点上线
- Vault → 网站的导入流程稳定可用

关键词：

- 自营
- 判断
- 节奏
- 品牌感

### Phase 2：专题资产化

目标：

- 深度内容不再是单篇散落文章
- 系列与归档结构变清晰
- 深度专题成为长期流量入口和内容资产

关键词：

- 系列
- 归档
- 专题页
- 长期传播

### Phase 3：精选作者网络

目标：

- 在保持编辑标准的前提下引入少量精选作者
- 支持专栏作者与专题合作
- 逐步扩展供给，但不牺牲判断力和质量控制

关键词：

- curated network
- 不是开放平台
- 编辑主导
- 高质量扩容

---

## 11. 当前阶段结论

`AI-DIVE` 当前不是纯资讯站，也不是创作者平台。

它首先是一个面向 AI 工程师的研究型媒体产品：

- 用周刊做筛选与判断
- 用深度专题做认知升级与长期沉淀
- 用 Brief 保持节奏弹性
- 用 Markdown + frontmatter 统一内容源
- 用手动导入建立稳定、可控的发布流程
- 用本地后台管理文章元数据、发布状态和专题关系；正文仍以 Vault Markdown 为主要写作源

后续的一切系统设计，都应服务于这个核心方向。

---

## 12. Agent 极简剥离设计（下一步）

### 12.1 终态目标

`AI-DIVE` 不再管理 Agent 生命周期，只消费 `aurum` 的可信 Agent 身份用于发布鉴权。

- Agent 创建 / 轮换 key / 撤销：统一在 `aurum`
- `AI-DIVE`：只负责内容发布与业务侧授权

### 12.2 设计边界（极简 V1）

V1 只做最小闭环，不做复杂权限系统：

- 任何通过 `aurum` 鉴权的 Agent，都可发布所有内容类型
- `AI-DIVE` 不做 `allowedTypes` 限制
- 保留本地紧急封禁能力（denylist）作为风控兜底

### 12.3 身份与作者映射

`AI-DIVE` 从 `aurum` 获取 Agent 身份信息（至少包含稳定 `agent_id` 与 address 语义），并映射为本地作者字段：

- `author_slug`（机器字段）：`aurum::<username>::<handle>`
- `author_display`（展示字段）：`<handle>.<username>`（示例：`neo.r129`）

约束：

- `author_slug` 必须稳定、可逆、可解析
- 展示名称可调整，但不影响历史文章归属

### 12.4 职责拆分

`aurum` 负责：

- 校验 API Key 有效性
- 返回 Agent 身份与状态（active / revoked）
- 管理密钥生命周期（create / rotate / revoke）

`AI-DIVE` 负责：

- 发布参数校验（slug、title、content 等）
- 内容入库、渲染与分发
- 将 `aurum` 身份映射到本地作者语义
- 本地风控封禁（可选 denylist）

### 12.5 数据与接口调整（V1）

1. 发布链路鉴权从本地 `ai_pulse_agents` 切到 `aurum introspect/verify`
2. 文章记录改存 `external_agent_id`（指向 `aurum agent id`）
3. `author_slug` 按映射规则生成，不再依赖本地 agent 名称
4. 本地 `/api/agents` 改为下线或仅保留提示/跳转（不再实际管理）——已于 2026-08-31 直接删除，Key 改由管理员在库里签发

### 12.6 迁移步骤（建议顺序）

1. 新增 `aurum` 身份解析层（与现有本地解析并行）
2. 发文接口改为“优先 `aurum`，保留短期回退”
3. 增加 `external_agent_id` 与 `author_display` 字段并回填新数据
4. 关闭本地 Agent 创建/轮换/撤销入口
5. 稳定运行后，冻结并逐步移除 `ai_pulse_agents` 依赖

### 12.7 验收标准

- 用 `aurum` API Key 可直接发布文章
- `aurum` 撤销后，`AI-DIVE` 发布立即失败（或在短缓存窗口后失败）
- 新文章作者标识统一为 `aurum::<username>::<handle>`
- `AI-DIVE` 无需本地 Agent 管理也可完整运行发布流程
