# TODO

本文件按阶段描述 `AI早知道` 的建设事项，默认原则是：

- 先补齐当前 MVP 的关键缺口，再扩功能。
- 先做能形成闭环的能力，再做锦上添花的能力。
- 每一阶段都尽量产出“可上线、可验证、可度量”的结果。

## 阶段 0：文档与项目基线

### 已完成

- [x] 建立基础 Next.js App Router 项目。
- [x] 接入 Supabase。
- [x] 接入 Resend。
- [x] 建立首页、文章详情页、订阅页。
- [x] 建立订阅与确认 API。
- [x] 新增 `PRODUCT.md` 说明当前产品与架构。

### 待完成

- [x] 新增 `.env.example`，列出全部必要环境变量。
- [x] 重写 `README.md`，覆盖安装、运行、数据库初始化、部署说明。
- [x] 说明 Supabase 初始化方式，写清首次执行 `supabase/schema.sql`、已有环境按顺序执行迁移的规则。
- [ ] 确认并固定 Node.js / 包管理器版本。
- [x] 建立最基础的 CI，push/PR 到 `main` 时执行 `lint`。

## 阶段 1：打磨当前 MVP 闭环

目标：让“读文章 -> 订阅 -> 确认成功”这个链路更可靠、更清楚。

### 1.1 用户可见反馈

- [x] 首页增加 `confirmed` 查询参数对应的提示 UI。
- [x] 增加独立的订阅确认结果页，覆盖成功、链接无效、链接过期、系统错误四种状态。
- [x] 统一订阅页的错误文案，覆盖邮箱格式错误、重复订阅、确认邮件发送失败。
- [x] 为“未确认但重复提交”的邮箱返回可理解提示，并允许重新发送确认邮件。

### 1.2 订阅与确认 API

- [x] 为 `/api/subscribe` 增加请求体验证和结构化错误返回。
- [x] 为 `/api/subscribe` 增加 Resend 异常处理，不再在发信失败时直接返回成功。
- [x] 为 `/api/subscribe` 增加重复订阅分支处理。
- [x] 为 `/api/confirm` 增加过期、签名错误、缺失参数三类分支处理。
- [x] 为 `/api/confirm` 将结果跳转到独立确认结果页。

### 1.3 安全与密钥

- [x] 将订阅确认密钥从 `SUPABASE_SERVICE_ROLE_KEY` 中拆分，改为独立 `EMAIL_CONFIRMATION_SECRET`。
- [x] 重构确认 token，包含邮箱、过期时间、签名。
- [x] 为确认 token 增加过期时间校验。
- [x] 为确认 token 增加不可重放设计或明确记录当前限制。

### 1.4 日志与可观测性

- [x] 统一服务端日志前缀与字段，区分用户错误、外部依赖失败、数据库失败。
- [x] 在订阅和确认接口中记录关键失败原因，避免只有模糊 `console.error`。

### 1.5 测试

- [x] 建立最小测试基线。
- [x] 为确认 token 工具补充单元测试。
- [x] 为 `/api/subscribe` 补充核心分支测试。
- [x] 为 `/api/confirm` 补充核心分支测试。

## 阶段 2：内容生产与发布能力

目标：从“能展示文章”升级为“能稳定生产和发布文章”。

- [x] 明确文章内容格式：Vault 使用 Markdown，导入后转换为 HTML，展示前经过 `rehype-sanitize` 消毒。
- [x] 为文章渲染增加 HTML 消毒，解决 `dangerouslySetInnerHTML` 风险。
- [x] 建立已导入文章的元数据编辑 / 发布后台入口。
- [x] 建立后台文章正文编辑和新建文章入口。
- [x] 增加 Markdown 草稿预览能力。
- [x] 支持文章级 metadata 和 Open Graph；结构化数据仍未实现。
- [ ] 支持封面图、作者、分类、标签等扩展字段。
- [ ] 为首页补充分页或归档策略，避免文章增多后列表失控。

## 阶段 3：Newsletter 运营能力

目标：把订阅名单变成真正可运营的邮件渠道。

- [x] 实现批量发送 newsletter 的任务流程。
- [x] 将每次发送写入 `ai_pulse_email_sends`。
- [ ] 增加打开追踪和点击追踪能力（`opened_at`/`clicked_at` 字段已预留，尚未写入）。
- [x] 增加退订链接和退订处理。
- [ ] 增加发送模板管理能力。
- [ ] 区分“站内发布”和“邮件发送”的状态机，避免内容发布与投递强耦合。
- [ ] 建立基础运营指标面板：订阅数、确认率、打开率、点击率。

## 阶段 4：付费订阅闭环

目标：把当前的"软付费提示"升级为真实的付费与额度系统。

现状（2026-08-27 设计定稿，替代旧的 `is_premium` 占位思路）：情报/深度/洞见已彻底移除 `is_premium` 付费墙，发布即全文可读，保持公开免费。出品（`/decks`）暂时只做登录门禁，不区分付费——本阶段就是把它落地成真正的付费墙。以下方案是完整讨论后的结论，实现顺序按 4.1 → 4.2 → 4.3 → 4.4。

### 4.0 三层访问模型（已定方向，不再讨论）

| 层 | 栏目 | 登录 | 收费 |
|---|---|---|---|
| 公开 | 信号 / 深度 / 洞见 / 专题 | 否 | 免费 |
| 账号 | 探索（`/agent`）+ 所有 AI 解读 | 是 | 免费，但计 credits 防爆仓 |
| 付费 | 出品（`/decks`） | 是 | 单篇/系列买断，更新免费 |

统一原则：公开内容匿名可读，凡是有状态的（AI 对话、购买）一律绑账号。出品购买前必须先注册登录（不做匿名购买），邮箱验证墙保持强制不放开——credits 免费额度按账号发放，验证是防止脚本批量注册刷额度的最低成本防线；出品购买路径本身安全价值低，但改动收益不足以为它单独破例。

### 4.1 Credits 骨架（不依赖支付，可独立先做，优先建这块开始收集成本数据）

- [x] 新增 `ai_pulse_credit_ledger`（append-only：`user_id, delta, reason, period, ref_id, created_at`），余额 = `SUM(delta) WHERE user_id = ? AND (period = 当期 OR period IS NULL)`；`period` 让过期变成隐式的，不需要清理任务（`supabase/migrations/20260827_create_credit_ledger.sql`）
- [x] 免费额度懒发放：消费前检查当期 `grant_free` 记录是否存在，不存在才插入，靠 `(user_id, reason, period)` 唯一索引保证幂等，不用挂 cron（`src/lib/credits.ts` `ensureFreeGrant`）
- [x] `src/app/api/agent/route.ts` 调 gateway 前查余额拦截（余额 `<=0` 返回 402），调用成功（`upstream.ok`）后才插一条 `delta=-1`——全站 LLM 调用只有这一个出口（浏览器不直连 pi-gateway），前端和 gateway 都不用改；先查后花，不做"先扣后退"，失败路径不产生任何 ledger 写入，天然不需要冲正
- [x] 计费粒度先按"一轮对话 = 1 credit"，不按 token（pi-gateway 暂无 usage 回传，且这样用户更好理解账单）
- [x] 额外加一层小时级速率限制（读现有 `spend_agent` 行的 trailing-hour 计数，不建新表也不额外写入）——credits 是经济模型（月度额度），速率限制是防滥用（短时高频），两者不是一回事，只靠 credits 拦不住"一下午打光月度额度"（`src/lib/credits.ts` `withinHourlyLimit`，超限返回 429）
- [ ] 用户菜单显示当期余额；余额耗尽时 402 状态对应的引导 UI（提示充值/等下月刷新）——402/429 的错误文案已经通过 `useAgentChat.ts` 现有的 `!res.ok` 分支原样透出到对话气泡，仍缺一个随时可见的余额展示入口
- [x] 免费额度先给宽松值，不要现在拍定价：`FREE_MONTHLY_CREDITS = 1000`（约每天 33 次），`HOURLY_SPEND_LIMIT = 50`——月度宽松是因为当前无法向撞墙用户变现（付费出口还没做），提前拦掉活跃用户只有下行没有上行；小时限制独立设置是为了防止失控脚本/重试循环在几分钟内烧掉大比例月度额度，不是为了限制真实人类的正常聊天节奏。先跑数据收集期，再回头拿真实用量分布定免费额度和会员卡定价（数据收集本身是运营动作，不是代码任务）

### 4.2 出品栏目公开化 + 内容访问改造

- [x] `/decks` 列表页去掉登录门禁（`src/app/decks/page.tsx`），改为公开渲染，展示标题/简介/kicker/价格；`NavLinks.tsx` 里 `/decks` 的 `gated: true` 也一并去掉，否则未登录点击导航仍会被拦去登录页
- [ ] **R2 访问收紧——原计划"关闭 bucket 公开访问"是错的，已撤回，改成下面这个方案。** `CLOUDFLARE_R2_BUCKET_NAME`/`CLOUDFLARE_R2_PUBLIC_URL` 这对 env 是全站公用的一个 bucket，除了 decks 还扛着文章配图（`/api/upload`、`/api/upload/presign`）、AI 对话贴图、`::embed{src=...}` 嵌入内容的安全校验域名——整桶关掉公开访问会连带炸掉这三处。正确做法：新建一个**专用于 decks 的私有 bucket**（新建的 R2 bucket 默认就是私有的，只要不开 `r2.dev` 子域名/不绑自定义域名，天生私有，不需要"关闭"任何东西），服务端 S3 client 用 access key/secret 照样能读。现有公开 bucket 保持不动。
  - 操作步骤：① 在 Cloudflare 建新 bucket；② 确认现有 R2 API token 的权限范围覆盖到新 bucket（按 bucket 授权的 token 不会自动生效，可能要重新签发）；③ 加新 env var（如 `CLOUDFLARE_R2_DECKS_BUCKET_NAME`），`src/lib/r2.ts` 的 `fetchDeckObject()` 和 `scripts/import-deck.mjs` 都改成指向它；④ 用 `import-deck.mjs` 把现有 3 个 deck 重新导入到新 bucket（幂等，直接重跑即可）；⑤ 旧 bucket 里的 `decks/` 前缀可以事后清掉（卫生问题，不是安全阻塞项）。①②是 Cloudflare 控制台操作，我这边做不了；③④是代码/脚本改动，可以随时接手做
- [x] 用带鉴权的 Route Handler 替换 `next.config.ts` 里现有的 `/decks/:slug/:path*` → R2 `rewrites()`：`src/app/decks/[slug]/[...path]/route.ts` 校验 `canAccessDeck()` 后用 `src/lib/r2.ts` 新增的 `fetchDeckObject()`（`GetObjectCommand`）读对象流式返回，响应头 `Cache-Control: private`（不再是公开可被 CDN/其他访客共享缓存的响应）。URL 保持同源不变（仍是 `/decks/xxx/yyy`），deck 内容和内部相对链接一个字节都不用改。每个子资源请求（图片等）都独立校验一次，不是只挡入口 HTML
  - 明确排除 presigned URL 方案：deck 是一个 HTML + 多个相对路径引用的资源（图片等），presigned URL 只能签单个对象，HTML 里的相对链接会拼出不带签名的 R2 直链导致 403；服务端代理是唯一同时满足"能鉴权"又"不用重写内容"的方案
- [x] `ai_pulse_decks` 加 `price_cents`、`currency`（`supabase/migrations/20260827_decks_pricing_and_orders.sql`）；`price_cents IS NULL` = 仍然免费，`canAccessDeck()`（`src/lib/decks/access.ts`）是内容路由和列表页共用的唯一权限判定点
- [x] 新增统一订单表 `ai_pulse_orders`（`user_id NOT NULL`，冗余存一份 `email` 便于对账/找回，`kind` ∈ `deck`/`membership`，`ref`（deck_slug 或 plan_id），`amount_cents`，`provider`，`provider_order_id`，`status`，`paid_at`）——出品买断和会员卡本质都是一次性付款，用同一张表、同一套 provider 集成、同一套回调验签，不建两套
- [x] 买断制：一条 `paid` 记录即永久访问权限。"更新免费"因此不需要任何额外代码——权限按 `deck_slug` 判定，与内容版本无关，R2 里的文件随便更新
- [x] `scripts/import-deck.mjs` 加 `--price=<yuan>`（如 `--price=19.9`）/`--currency` flag，换算成 `price_cents` 写入；不传该 flag 时完全不带这个字段进 payload（而不是传 `undefined`/`null`），所以刷新一个已定价 deck 的内容不会把价格意外清空；`--price=0` 是显式清价回到免费的转义口。后台可视化编辑入口已补上（`/admin/decks`，2026-08-31），改价不用再走 CLI；这个 flag 仍是唯一能改正文/上下架内容的路径（正文托管在 R2，后台不碰）
- [x] 列表页对 priced-且-未购买 的 deck 现在渲染真正的购买按钮（`src/components/DeckBuyButton.tsx`）——4.3 支付宝官方通道打通后替掉了原来的"购买功能开发中，敬请期待"占位

### 4.3 支付通道接入

- [x] 抽象 provider 接口（`createOrder` / `verifyCallback` / `queryStatus`，`src/lib/payments/types.ts`），`ai_pulse_orders` 字段本身 provider-agnostic，换通道不动订单模型
- [x] 接入个人可开通的聚合支付通道——建的是通用的"易支付"协议实现（`src/lib/payments/epay.ts`），不是绑定某一家。虎皮椒的历史 API、码支付、彩虹易支付各种克隆站、ZPAY 等一大批面向个人的聚合商都实现同一套协议（`pid`/`key`/MD5 签名、`submit.php` 页面跳转、`notify_url` 异步回调），选哪家只是配 `EPAY_PID`/`EPAY_KEY`/`EPAY_BASE_URL` 三个环境变量的事，不用换代码——因为当前没有企业/个体户经营主体，微信支付/支付宝官方直连、国内持牌聚合支付（Ping++等）都过不了资质审核
  - 协议细节核对自公开文档（页面跳转 `submit.php` 不需要 `clientip`/`device`，这两个字段只有服务端直出 JSON 的 `mapi.php` 接口才需要，所以整个下单流程是纯字符串拼接，不需要请求上下文）；`src/lib/payments/epay.test.ts` 里的签名校验是照文档独立重写的算法，不是照抄实现代码，真能测出"实现跟协议对不上"这种问题
  - 订单创建（`src/lib/decks/orders.ts` `createDeckOrder` + `POST /api/decks/[slug]/orders`）：校验有价可买、未重复购买，插入 `pending` 订单，问 provider 要 `payUrl`，浏览器跳转过去
  - 异步回调（`GET /api/orders/callback/epay`）：验签 + 校验 `trade_status=TRADE_SUCCESS` 后把订单从 `pending` 改成 `paid`；`.eq('status','pending')` 这个过滤条件保证回调被重复投递时不会被处理两次；成功后必须回纯文本 `"success"`（不是 JSON）通道才会停止重试，这是协议要求
  - **还没打通真实通道**：没有任何一家聚合商的 `pid`/`key` 可用，代码目前完全没有被真实调用过、也没有跑过一次真实收款——签名算法本身有单测覆盖，但请求/响应的实际字段、多渠道之间的细节差异，仍需要拿到真实账号后走一遍才能确认。缺 `EPAY_*` 三个环境变量时 `getPaymentProvider()` 会直接抛错，不会静默失败
- [x] **接入支付宝官方电脑网站支付**（2026-08-30，已有商户主体并签约"电脑网站支付"）：`src/lib/payments/alipay.ts` 实现同一个 `PaymentProvider` 接口，`alipay.trade.page.pay` 页面跳转 + RSA2 公钥模式，`getPaymentProvider(method)` 按支付方式分流（`alipay` → 官方通道，`wechat` → 仍走易支付）。配 `ALIPAY_APP_ID`/`ALIPAY_PRIVATE_KEY`/`ALIPAY_PUBLIC_KEY` 三个环境变量
  - 签名规则在支付宝这里是**不对称**的：请求签名要带 `sign_type`，异步通知验签要去掉——两边套同一套规则会得到 `isv.invalid-signature`，这个坑有专门的回归测试钉住
  - 回调 `POST /api/orders/callback/alipay` 是表单 POST（不是易支付的 GET），验签之外还校验 `app_id` 属于本应用（合法签名不等于发给我们的通知）；落单逻辑抽到 `src/lib/payments/settle.ts` 两条通道共用，含**金额比对**（防止改价解锁）和"重复投递 → already_paid → 照样回 success"的幂等处理
  - 已用只读的 `alipay.trade.query` 对真实商户号验证：请求签名、支付宝公钥验签、APPID、签约状态全部通过（返回 `ACQ.TRADE_NOT_EXIST`，查假单号的正确响应）。**真实付款 + 回调解锁这条链路仍未跑过**，等首笔 ¥19.90 支付走完才算确认
- [x] 明确记录并接受这个限制：这类通道本质是"二清"渠道，不受官方商户协议保护，有单日限额和随时断线/封号的风险，只作为验证阶段方案，不是长期主力；后续若拿到企业主体或境外账户（可走 Stripe/Airwallex 等跨境路线开通 Alipay/WeChat Pay 收款方式），只需要新增一个实现 `PaymentProvider` 接口的文件、切 `getPaymentProvider()` 的 env 开关，不用重做订单模型
- [ ] 会员卡不做自动续费——个人聚合通道签不了代扣协议，做成一次性付款的月卡/季卡/年卡，到期手动再买（会员卡本身待 4.4 做）

### 4.3.1 打通真实通道之前，可以先做的（2026-08-27 讨论定稿）

不用等 `EPAY_*` 到位——下面这些都是纯代码/本地可验证的工作，优先级从高到低：

- [ ] **mock 支付 provider**（`PAYMENT_PROVIDER=mock` 开关）：实现同一个 `PaymentProvider` 接口，`createOrder` 返回一个本地假的确认页，`verifyCallback` 由本地手动触发——目的是在拿到真实商户号之前，把"下单 → 回调 → 订单变 paid → 内容解锁"这条完整链路自己先跑通、自己先发现 bug，而不是等注册好聚合商那天才第一次真实验证。这是现在最优先的一项，因为目前这条链路从写完到现在从没被完整跑过一次（真实调用、真实回调都没有）
- [ ] `/decks/[slug]` 详情页：替掉现在"点了就是死链接 / 裸 JSON 403"这个粗糙状态，未定价 → 直接看；定价未购买 → 显示价格 + 购买按钮；已购买 → 显示内容
- [x] 列表页装真正的购买按钮（`src/components/DeckBuyButton.tsx`）：调 `POST /api/decks/[slug]/orders` → 跳转 `payUrl`，401 时带 `next` 参数送去登录。因为拿到了真实支付宝商户号，直接跳过了上面的 mock provider，按钮只提供支付宝一种方式（微信没有凭证）
- [ ] 用上已经写了但还没接的 `provider.queryStatus()`：`return_url` 落地页主动查一次订单状态并兜底同步——异步回调（`notify_url`）不保证送达及时（用户付完钱就关掉页面是常见情况），只靠回调会出现"钱付了但没解锁"的体验问题
- [ ] `/my/orders` 页面：展示自己的购买记录（pending/paid），方便用户和我们自己排查问题

### 需要你做的（我这边做不了）

- [x] ~~去注册一个易支付协议的聚合商~~ —— 已改为直接开通支付宝商户并签约"电脑网站支付"，凭证已配置。微信支付若要接，仍需要一个易支付聚合商的 `EPAY_PID`/`EPAY_KEY`/`EPAY_BASE_URL`
- [ ] R2 bucket 分离（见 4.2 那条，跟支付无关但同样是上线前必须完成的）
- [x] 定第一篇要卖的 deck 和价格：「推理工程实战手册」（`inference-engineering`）¥19.90，已写入 `ai_pulse_decks.price_cents`
- [ ] 走一笔真实的 ¥19.90 支付，确认回调解锁链路（这是支付部分最后一个未验证环节）

### 4.4 会员卡与内容边界

- [ ] 会员卡购买（`kind='membership'`）履约为发放 credits（`reason='grant_plan'`），**不包含出品内容**——出品买断和会员卡额度是两条独立的线，不要打包进同一张卡：混在一起会让退款、有效期、"会员到期了已买的出品还能看吗"这类边界变脏
- [x] 订单记录展示，出品购买和会员卡记录共用同一张表——最终没有单开 `/my/orders`，而是并进控制台（`/dashboard` 的「我的订单」卡片，`src/lib/orders/list.ts`）：控制台精简后本来就只剩额度和账号两块，再拆一个只放一张列表的页面没有意义。会员卡订单（`kind='membership'`）走同一个查询，届时不用改页面

### 已放弃 / 明确不做

- **登录后购买折扣**：出品购买前强制要求注册登录，人人都是登录价，折扣这个"拉注册"的钩子已经没有存在意义，不做差异化定价
- **匿名购买（邮箱锚点，不强制注册）**：曾讨论过用邮箱当身份锚点让未注册用户也能购买，但会引入签名访问链接、cookie 绑定、注册后回填 `user_id` 等一整套机制；权衡后选择更简单的"购买前必须注册"，如果后续数据显示购买转化因此流失严重，是可逆的增量改动（`ai_pulse_orders.user_id` 改可空 + 用已冗余的 `email` 列做回填 join）
- **邮箱验证墙放开为软提醒**：目前保持 `src/lib/auth.ts:28` 强制验证不改。如果未来确实需要放开，正确做法是把验证要求从"登录"移到"发放免费 credits"（`grant_free` 只对 `email_verified_at IS NOT NULL` 生效），而不是整体拆掉验证

## 阶段 5：工程质量与可运维性

目标：让项目具备可持续迭代能力，而不是停留在手工维护阶段。

- [x] 建立订阅、确认、退订、Markdown 和 newsletter 发送核心测试（当前 31 个测试通过）。
- [x] 补充文章管理 API 和作者标识工具测试；Agent 发布、Signals、上传 API 测试仍待补充。
- [ ] 补充集成测试，覆盖核心 API 路由。
- [x] 建立数据库迁移策略，替代单一 `schema.sql` 手工维护（`supabase/migrations/`）。
- [ ] 接入错误监控与告警。
- [ ] 建立审计与运营日志规范。
- [ ] 对外部依赖失败场景做降级设计，例如 Resend 或 Supabase 不可用。
- [ ] 明确缓存策略与失效策略，覆盖首页与文章详情页。
- [x] 将 CI 从仅执行 lint 扩展为 lint、test、build。

## 阶段 6：增长与体验优化

目标：在闭环稳定后再做增长，不要提前优化空流量。

- [ ] 优化首页视觉层级与品牌表达，摆脱默认模板气质。
- [ ] 优化 Dive / Insight 文章页的长文标题层级：
  - H2：桌面 `28px`、移动端 `25px`，上/下间距 `64px / 20px`，增加克制的暖灰分隔线或短橙色章节标记。
  - H3：桌面 `22px`、移动端 `20px`，上/下间距 `44px / 14px`，保持黑色中等字重衬线标题，不使用分隔线。
  - H4：`17px` 无衬线 `600`，上/下间距 `32px / 10px`，使用暖灰文字或小型行内标记，明确表现为小节标签。
  - 为标题启用 `text-wrap: pretty`，保持 H2 -> H3 -> H4 的语义顺序，不自动添加章节编号。
  - 分别在桌面和移动端验证长标题换行、标题与正文/链接/Callout 的视觉优先级，以及连续滚动时的章节辨识度。
- [x] 为超长文章增加低干扰文章目录：`ArticleToc.tsx`，H2/H3 数量 ≥3 时左上角悬浮图标按钮，点开面板列出章节（H3 缩进），点击平滑滚动并收起；标题从 `post.content` 服务端解析（`extract-headings.ts`），未额外做桌面侧栏方案。
- [x] 为文章页 AI解读 面板（`ArticleChatPanel.tsx`）增加"放大 / 还原"：最终没有复用 `agent-screen`
  全屏机制，而是 `maximized` state 切到 `fixed inset-0`（详见 PRODUCT.md），context 仍绑定当前
  文章。2026-08-27 补齐宽度细节：放大后消息列表和输入框内容列改为 `mx-auto max-w-[860px]`，
  与 `/agent` 探索页的内容列宽保持一致，不再撑满整个视口宽度（docked/侧栏窄面板下这个
  max-width 不生效，行为不变）。待拍板：①移动端 overlay 本来已接近全屏，是否也要放大按钮；
  ②关闭面板时是否记住 maximized 状态，还是每次都重置为并排小面板重新打开。
- [ ] 出品（`/decks`）增加 AI解读能力，目前有两个卡点，其中一个已经有解法路径：
  ①`ai_pulse_decks` 没有可喂给模型的全文字段——多数条目的源 markdown 能在 Vault 里找到（如 `agent-harness-speech-v0.4.0.md`、ribbit 两封信译文、inference-engineering 的 zh/ 分章），可以加一列 `body_markdown` 并在 `import-deck.mjs` 里带上，但 `harvey-playbook`、`anthropic-founders-playbook`、`chuhai-growth-os` 目前没找到明显的 md 源，需要手动补或从 HTML 兜底抽取，仍未解决；
  ②出品条目是 `target="_blank"` 跳到 R2/`public/decks/` 上的独立 HTML，不在 `/decks` 自己的页面内渲染，没有地方吸附现有 `ArticleChatPanel.tsx` 这类侧栏——阶段 4.2（出品付费墙）本来就要建一个站内鉴权查看器路由替换直链跳转，届时这个查看器页面就是天然的挂载点，不用为 AI解读单独再建一套。
- [ ] 增加订阅转化文案与落地页实验。
- [ ] 增加推荐阅读、相关文章、热门内容模块。
- [ ] 支持搜索、标签页或专题页。
- [ ] 增加分享能力与社交传播素材。
- [ ] 建立基础埋点，评估首页到订阅页的转化漏斗。

## 当前建议优先级

下一轮短周期迭代建议优先完成：

- [x] `.env.example`
- [x] 重写 `README.md`
- [x] 首页确认结果反馈
- [x] 独立确认 secret
- [x] 带过期时间的确认 token
- [x] 邮件发送失败处理
- [x] HTML 消毒方案
- [x] 订阅 / 确认 API 测试
- [x] 后台正文编辑与草稿预览
- [x] 文章管理 API 和作者标识测试
- [x] CI 增加 test 和 build

### 下一步执行拆分

1. 优化 Dive / Insight 文章页 H2/H3/H4 标题层级，并完成桌面与移动端视觉验证。
2. 为 Agent 发布、Signals 注入和文件上传 API 增加核心测试。
3. ~~应用 `20260804_add_author_display.sql` 数据库迁移。~~（已完成，线上库已有 `author_display` 列）
4. 明确后台编辑内容与 Vault Markdown 之间的同步规则。
