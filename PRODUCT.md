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
- 后台管理端（`/admin`）：文章元数据编辑、精选管理、专题（系列）创建与排序
- 后台文章工作流（`/admin/new`、`/admin/edit/[slug]`）：创建文章、编辑 Markdown 正文、预览、保存草稿、发布和撤回
- 用户文章管理（`/my/posts`）：查看和编辑自己发布的文章元数据
- Agent 发布接口（`/api/posts`、`/api/signals`）
- R2 文件上传接口（`/api/upload`、`/api/upload/presign`）
- 系列页（`/series`）
- Newsletter 批量发送（`/api/admin/posts/[slug]/send`）：遍历活跃订阅者、去重已发送、写入 `ai_pulse_email_sends`
- 退订链接与退订处理（`/api/unsubscribe`）
- HTML 消毒（`rehype-sanitize` + `rehype-raw`）
- 数据库迁移体系（`supabase/migrations/`，非单一 `schema.sql`）
- 基础 CI（GitHub Actions，push/PR 到 `main` 时跑 `lint`）
- 登录门禁（`/agent`、`/dashboard`、`/my/posts`、`/admin/*`、文章 AI解读 面板）：服务端鉴权，未登录直接在 Server Component 里 `redirect('/login?next=...')`，不再有"先渲染空白、客户端 hydrate 完再检查 localStorage 才决定要不要跳转"的闪烁；登录成功后自动返回原页面（AI解读面板会带着 `?open=chat` 标记自动重新打开）——`/decks` 列表页已改为公开访问（阶段 4.2），不再走这条门禁
- 登录态：next-auth（httpOnly、加密 JWT session cookie），服务端 Server Component / Route Handler 用 `getServerSession()` 本地验签即可拿到用户，不再需要每次请求查 `ai_pulse_user_sessions` 表；`/agent` 页面的对话历史在 SSR 阶段直接查出来传给客户端，不再有"渲染空壳、hydrate 后再 fetch 一次"的额外往返
- Agent 对话图片输入（`/agent`、文章 AI解读 面板）：粘贴图片时，`pi-gateway` 仅为携带图片的这一回合切换到 DeepSeek vision 模型（`deepseek-v4-flash-vision-exp`），回复完成后切回默认文本模型
- Agent 会话持久化（`/agent`、文章 AI解读 面板）：登录用户的每一轮对话写入 `ai_pulse_chat_turns`（按 `user_id` + `context_key` 归属，`context_key` 是文章 slug 或字面量 `global`），刷新页面/换设备会重新加载最近 10 轮；图片附件上传到 R2（`users/<userId>/chat/...`），`imageUrls` 随历史一起落库；`pi-gateway` 冷启动（同一 tab-scoped 匿名 session 30 分钟 TTL 过期后的下一次请求）时会用 `SessionManager.appendMessage()` 把这份历史原样灌回 `AgentSession`，让模型"记得"之前聊过什么——历史里的纯图片轮次回放时替换成文字占位符，不重新下载图片
- `/insights` 来源胶囊过滤（`InsightsList.tsx`，客户端组件）：按 `author_display` 分组统计后渲染一排胶囊（含"全部"），点选后仅客户端过滤当前已加载的列表，不发起新请求；胶囊嵌在 `ListPageHeader` 的 `filters` 插槽里，渲染在标题分隔线之上
- Agent 停止按钮真取消（`/agent`、文章 AI解读 面板）：点击停止时，除了 abort 掉浏览器自己的 fetch，还会调用 `POST /api/agent/cancel` 直接告诉 `pi-gateway` 中止那个 session 的生成——不依赖 HTTP 连接断开检测，因为 `/api/agent` 跑在 Vercel 的 Node.js Serverless 运行时上，浏览器断连这件事根本不会传导到正在执行的函数实例，纯连接层面的 abort 会导致 gateway session 卡在"busy"直到原生成自然跑完（`pi-gateway` 自身也在 `server.ts` 把断连检测从 `req.on("close")` 修成了 `res.on("close")`，但这只覆盖常驻进程场景，Vercel 场景仍需这个显式 cancel 端点）

### 7.2 当前明确未实现

- Vault 内容自动回写（后台正文编辑不会自动同步回 Vault，仍需明确内容事实源）
- 自动化内容导入后台（当前是手动触发的 CLI 脚本，见 4.1 节，这是有意选择而非缺口）
- 打开追踪与点击追踪（`ai_pulse_email_sends.opened_at`/`clicked_at` 字段已预留，未写入）
- 邮件模板管理（当前硬编码单一模板）
- 运营指标面板（订阅数、确认率、打开率、点击率）
- 真正的付费访问控制：情报/深度/洞见已彻底移除 `is_premium` 付费墙（不再读取该字段）；出品（`/decks`）已具备访问控制骨架和下单/回调后端（`src/lib/payments/`、`src/lib/decks/orders.ts`，阶段 4.2/4.3），走的是通用"易支付"协议、可换供应商。但还没有真实支付账号能验证过一次真实收款，列表页也还没接购买按钮——priced 的 deck 现在仍展示"购买功能开发中"
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
4. 本地 `/api/agents` 改为下线或仅保留提示/跳转（不再实际管理）

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
