# 域名迁移：ai.air7.fun → ai.air7fun.com（Cloudflare CDN）

## 目标

将 AI-DIVE 项目从 `ai.air7.fun` 迁移到 Cloudflare 托管的 `ai.air7fun.com`，获得免费 CDN 加速。

---

## 📋 迁移工作清单

### 一、基础设施配置（需要你操作）

#### 1. Vercel 域名配置
1. 登录 Vercel Dashboard: https://vercel.com/dashboard
2. 进入 `ai-dive` 项目
3. Settings → Domains
4. 添加域名：`ai.air7fun.com`
5. Vercel 会提供 DNS 配置要求（通常是 CNAME 到 `cname.vercel-dns.com`）

#### 2. Cloudflare DNS 配置
登录 Cloudflare Dashboard，找到 `air7fun.com` 站点：

| 类型 | 名称 | 内容 | 代理状态 | TTL |
|------|------|------|----------|-----|
| CNAME | `ai` | `cname.vercel-dns.com` | **已代理（橙色云朵）** ✅ | 自动 |

**关键：必须开启代理（橙色云朵），才能启用 CDN。**

#### 3. Cloudflare SSL/TLS 配置
在 Cloudflare → SSL/TLS：
- **加密模式：** `Full (strict)` ✅（Cloudflare ↔ Vercel 使用加密连接）
- **Always Use HTTPS：** 开启 ✅
- **Minimum TLS Version：** TLS 1.2
- **Automatic HTTPS Rewrites：** 开启 ✅

#### 4. Cloudflare 缓存规则配置

**使用 Cache Rules（新版，比 Page Rules 更灵活）：**

进入 Cloudflare → 规则 → Cache Rules，创建以下规则：

##### 规则 1：缓存 Next.js 静态资源（最重要）
- **规则名称：** `AI-DIVE Cache Next.js Static`
- **匹配条件：**
  - Hostname equals `ai.air7fun.com`
  - URI Path starts with `/_next/static/`
- **缓存设置：**
  - Eligibility: Eligible for cache
  - Edge TTL: 1 year
  - Browser TTL: 1 year

##### 规则 2：缓存公共资源
- **规则名称：** `AI-DIVE Cache Public Assets`
- **匹配条件：**
  - Hostname equals `ai.air7fun.com`
  - URI Path starts with `/public/`
- **缓存设置：**
  - Eligibility: Eligible for cache
  - Edge TTL: 1 month
  - Browser TTL: 1 day

##### 规则 3：跳过 API 缓存
- **规则名称：** `AI-DIVE Bypass API Cache`
- **匹配条件：**
  - Hostname equals `ai.air7fun.com`
  - URI Path starts with `/api/`
- **缓存设置：**
  - Eligibility: Bypass cache

##### 规则 4：标准缓存
- **规则名称：** `AI-DIVE Standard Cache`
- **匹配条件：**
  - Hostname equals `ai.air7fun.com`
- **缓存设置：**
  - Eligibility: Eligible for cache
  - Browser TTL: 4 hours
  - Respect origin cache headers: Yes

---

### 二、代码修改（需要更新的文件）

#### 1. 环境变量（3个文件）

**`.env.local`** (本地开发，保持不变)
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

**`.env.vercel`** (生产环境)
```bash
# 修改前
NEXT_PUBLIC_SITE_URL=https://ai.air7.fun
NEXTAUTH_URL=https://ai.air7.fun

# 修改后
NEXT_PUBLIC_SITE_URL=https://ai.air7fun.com
NEXTAUTH_URL=https://ai.air7fun.com
```

**Vercel 环境变量面板**
需要在 Vercel Dashboard → Settings → Environment Variables 中更新：
- `NEXT_PUBLIC_SITE_URL` = `https://ai.air7fun.com`
- `NEXTAUTH_URL` = `https://ai.air7fun.com`

#### 2. 文档中的域名引用（6个文件）

需要批量替换 `ai.air7.fun` → `ai.air7fun.com`：

- `README.md` - Wiki 子站路径说明
- `docs/api-guide.md` - 所有 API 示例 URL（~25 处）
- `.claude/skills/ai-dive-api/SKILL.md` - Skill 说明中的域名
- `.claude/skills/ai-dive-api/references/posts.md` - API 示例（3 处）
- `.claude/skills/ai-dive-api/references/topic-picker.md` - API 示例（2 处）

#### 3. 代码中的动态引用（无需修改）

以下代码已经使用环境变量，迁移后自动生效：

- `src/app/layout.tsx:9` - `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)`
- `src/app/api/auth/verify/route.ts` - 使用 `req.nextUrl.origin`
- `src/app/api/confirm/route.ts` - 使用 `req.nextUrl.origin`
- 所有 NextAuth 回调 - 使用 `NEXTAUTH_URL` 环境变量

---

### 三、OAuth 回调地址更新（如果使用了第三方登录）

如果项目配置了 GitHub/Google/微信等第三方登录，需要更新回调 URL：

#### NextAuth 回调地址
- **老地址：** `https://ai.air7.fun/api/auth/callback/*`
- **新地址：** `https://ai.air7fun.com/api/auth/callback/*`

需要在以下平台更新（如果使用）：
- GitHub OAuth Apps
- Google Cloud Console
- 微信开放平台

---

### 四、支付回调地址更新（重要）

#### 易支付（Epay）回调地址
- **老地址：** `https://ai.air7.fun/api/orders/callback/epay`
- **新地址：** `https://ai.air7fun.com/api/orders/callback/epay`

需要在易支付商户后台更新异步通知 URL。

#### 支付宝回调地址
- **老地址：** `https://ai.air7.fun/api/orders/callback/alipay`
- **新地址：** `https://ai.air7fun.com/api/orders/callback/alipay`

需要在支付宝开放平台应用配置中更新：
1. 登录 https://open.alipay.com
2. 找到对应的应用
3. 开发设置 → 接口加签方式 → 授权回调地址
4. 更新为新域名

---

### 五、邮件链接更新（需要验证）

项目使用 Resend 发送邮件，检查以下邮件模板中的链接：

#### 1. 邮箱验证链接
- **文件：** `src/lib/email.ts`（如果存在）
- **链接格式：** `${process.env.NEXT_PUBLIC_SITE_URL}/api/confirm?token=...`
- **状态：** ✅ 使用环境变量，无需修改

#### 2. 订阅确认链接
- **格式：** `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe/confirmed?...`
- **状态：** ✅ 使用环境变量，无需修改

#### 3. 取消订阅链接
- **格式：** `${process.env.NEXT_PUBLIC_SITE_URL}/api/unsubscribe?...`
- **状态：** ✅ 使用环境变量，无需修改

---

### 六、Agent Gateway 配置更新

#### 服务端配置
**文件：** `services/pi-gateway/.env`

```bash
# 修改前
ALLOWED_ORIGINS=https://ai.air7.fun,http://localhost:3000

# 修改后
ALLOWED_ORIGINS=https://ai.air7fun.com,https://ai.air7.fun,http://localhost:3000
```

**说明：** 保留老域名 `ai.air7.fun` 以支持过渡期。

#### 主应用配置
**文件：** `.env.vercel`

```bash
# 如果 Gateway URL 包含域名，需要更新
AI_DIVE_AGENT_GATEWAY_URL=<检查是否需要更新>
```

---

### 七、SEO 相关配置

#### 1. Canonical URL
- **状态：** ✅ 已使用 `metadataBase`，自动生成正确的 canonical URL
- **验证：** 部署后检查页面源码 `<link rel="canonical">`

#### 2. Open Graph
- **状态：** ✅ 已使用 `metadataBase`，自动生成正确的 OG URL
- **验证：** 使用 https://www.opengraph.xyz/ 测试

#### 3. Sitemap（如果存在）
- **文件：** `public/sitemap.xml` 或动态生成
- **操作：** 搜索文件中是否硬编码了域名，如有则替换

#### 4. robots.txt（如果存在）
- **文件：** `public/robots.txt` 或动态生成
- **操作：** 更新 Sitemap URL（如有硬编码）

---

### 八、第三方服务配置更新

#### 1. Supabase
- **状态：** ✅ 无需修改（使用环境变量 `NEXT_PUBLIC_SUPABASE_URL`）
- **验证：** 检查 Supabase Dashboard 的 "Redirect URLs" 设置

#### 2. PostHog（如果使用）
- **配置项：** 域名白名单、CORS 设置
- **操作：** 无需修改（PostHog 通常不限制域名）

#### 3. Cloudflare R2（如果使用）
- **CORS 配置：** 检查 R2 Bucket 的 CORS 规则是否需要添加新域名
- **公开访问：** 检查 `CLOUDFLARE_R2_PUBLIC_URL` 是否包含域名

---

### 九、迁移后验证清单

#### A. DNS 验证
```bash
dig ai.air7fun.com +short
# 应该看到 Cloudflare IP（104.21.x.x 或 172.67.x.x）
```

#### B. CDN 验证
```bash
curl -I https://ai.air7fun.com/_next/static/css/app/layout.css
# 应该看到：
# server: cloudflare
# cf-cache-status: HIT（第二次请求）
# cf-ray: xxx-SIN
```

#### C. 功能验证
- [ ] 首页加载正常
- [ ] 用户注册/登录正常
- [ ] 邮箱验证链接正常
- [ ] `/agent` 对话功能正常
- [ ] `/decks` 付费内容访问正常
- [ ] 支付回调正常（如果已配置）
- [ ] 图片上传正常
- [ ] Newsletter 订阅/取消订阅正常

#### D. SEO 验证
- [ ] 页面源码中 canonical URL 正确
- [ ] Open Graph 标签正确（使用 https://www.opengraph.xyz/）
- [ ] Sitemap 可访问（如果有）
- [ ] robots.txt 正确（如果有）

---

### 十、老域名处理策略

#### 方案 A：301 重定向（推荐）
在 Vercel Settings → Domains：
- 保留 `ai.air7.fun` 域名
- 设置 301 永久重定向到 `ai.air7fun.com`

**优点：**
- 用户收藏的老链接仍然有效
- 已分享的链接自动跳转
- SEO 权重转移到新域名
- 搜索引擎会逐步更新索引

**缺点：**
- 老域名的流量不走 Cloudflare CDN（重定向发生在 Vercel）

#### 方案 B：并行运行（过渡期）
两个域名都保留并指向同一个 Vercel 项目：
- `ai.air7fun.com` - 主域名，有 CDN 加速
- `ai.air7.fun` - 副域名，无 CDN 加速

**优点：**
- 零风险，老链接继续有效
- 可以逐步引导用户切换

**缺点：**
- SEO 可能识别为重复内容（需要设置 canonical 指向新域名）
- 老域名流量仍然消耗 Vercel 带宽

#### 方案 C：完全废弃（不推荐）
删除 `ai.air7.fun`，只保留新域名。

**缺点：**
- 所有老链接失效
- 用户体验差
- SEO 权重丢失

**推荐使用方案 A**，设置 301 重定向。

---

### 十一、性能预期

| 指标 | 当前 (ai.air7.fun) | 迁移后 (ai.air7fun.com) |
|------|-------------------|------------------------|
| **DNS 提供商** | 阿里云 | Cloudflare ✅ |
| **CDN 加速** | ❌ 无 | ✅ 270+ 节点 |
| **静态资源延迟** | 300-400ms | 20-50ms ✅ |
| **首屏加载（中国大陆）** | 2-3s | 0.8-1.2s ✅ |
| **Vercel 带宽消耗** | 100% | 20-30% ✅ |
| **额外成本** | $0 | $0 ✅ |

---

### 十二、回滚方案（如果出现问题）

#### 快速回滚步骤
1. 在 Cloudflare DNS 中，关闭 `ai` 记录的代理（橙色云朵 → 灰色云朵）
2. 或者在 Vercel 中删除 `ai.air7fun.com` 域名
3. DNS 变更通常 5-15 分钟生效

#### 完全回滚
1. 在 Vercel 中删除 `ai.air7fun.com` 域名
2. 还原所有环境变量到老域名
3. 重新部署项目

---

### 十三、实施顺序建议

```
P0 - 基础设施（1 小时）
  1. Vercel 添加新域名
  2. Cloudflare DNS 配置（CNAME + 开启代理）
  3. Cloudflare SSL/TLS 配置
  4. Cloudflare Cache Rules 配置（4 条规则）

P1 - 环境变量（10 分钟）
  5. 更新 Vercel 环境变量
  6. 更新 .env.vercel 文件
  7. 更新 services/pi-gateway/.env

P2 - 代码修改（20 分钟）
  8. 批量替换文档中的域名引用（6 个文件）
  9. 提交代码并推送

P3 - 第三方服务（30 分钟）
  10. 更新支付回调地址（易支付 + 支付宝）
  11. 更新 OAuth 回调地址（如果有）
  12. 检查其他第三方服务配置

P4 - 验证与测试（30 分钟）
  13. DNS 验证
  14. CDN 验证
  15. 功能全流程测试
  16. SEO 验证

P5 - 老域名处理（5 分钟）
  17. 在 Vercel 设置 ai.air7.fun → ai.air7fun.com 301 重定向
```

**总耗时预估：** 2-3 小时

---

### 十四、关键风险点

#### 🔴 高风险
1. **支付回调地址未更新** - 会导致支付成功但订单状态未更新
2. **OAuth 回调地址未更新** - 会导致第三方登录失败
3. **邮箱验证链接错误** - 会导致新用户无法激活账号

#### 🟡 中风险
1. **Cloudflare 代理未开启** - 不会获得 CDN 加速
2. **Cache Rules 配置错误** - 可能缓存不该缓存的内容（如 API 响应）
3. **Agent Gateway CORS 未更新** - 会导致 /agent 对话失败

#### 🟢 低风险
1. **文档中的示例 URL** - 不影响功能，仅影响文档准确性
2. **老域名未设置重定向** - 用户需要手动更新书签

---

