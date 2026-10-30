# 内容管线契约（Content Pipeline Contract）

> 2026-10-30 立。回答一个架构问题：**导入管线要持续演进（新媒体类型、新渲染规则），而数据库与页面展示要保持稳定——两者之间的契约是什么？**
> 答案：契约就是管线输出的 **HTML 词汇表**。DB 与页面只消费这份词汇表渲染出的成品 HTML，不认识 markdown。

## 1. 分界点：成品 HTML 落库

```
Vault markdown ── build_channels（pod-pipe）──> aidive_build.md
  ── import-post.mjs（本机）── markdown-pipeline.mjs 渲染 ──> ai_pulse_stories
                                                                ├─ content（成品 HTML，物化视图）
                                                                └─ body_markdown（源，后悔药）
线上页面 ── MermaidContent 直接输出库存 content（dangerouslySetInnerHTML + 客户端后处理）
```

- markdown → HTML 的渲染发生在**导入时、导入者的本机**，线上页面**从不**重渲染文章 markdown。
- 因此管线代码（`src/lib/markdown-pipeline.mjs`）的改动**不需要部署即可对新导入生效**；线上部署只影响页面代码本身。
- **冻结特性**：存量文章的 `content` 是导入那一刻的渲染器产物，管线怎么改都不会回改旧文——这是展示稳定性的来源。要升级某篇文章的渲染，重跑 `npm run import:post`（upsert by slug，幂等）。
- **全量后悔药**：`body_markdown` 已落库，任何时刻都可以写 re-render 脚本用新渲染器批量重渲染。目前没有这个脚本，需要时再建。

## 2. 词汇表（管线当前可输出的元素）

| 词汇 | 生成方式 | 页面端配套 |
|---|---|---|
| 标准散文元素（p / h2-h4 / ul / ol / blockquote / table / img / a / strong / em / code） | remark 默认 | `.prose` CSS |
| 代码块（语法高亮 class） | `rehypePrettyCode`，import 时固化 class | `.prose` CSS |
| 数学公式 | `rehypeKatex` | KaTeX CSS |
| 章节锚点（h2-h4 自动 id + 自链接） | `rehypeSlug` + `rehypeAutolinkHeadings` | `extract-headings.ts` → `ArticleToc` 侧栏目录（只收 h2-h4） |
| Mermaid 图 | `rehypeMermaidBlocks` | `MermaidContent` 客户端渲染 |
| Callout 卡片 | `rehypeCallouts`（`> [!type]`） | `.prose` callout CSS |
| YouTube 播放器 | 裸链 → `rehypeYouTubeEmbeds` iframe；库存 HTML 里的 YouTube 链接也由 `MermaidContent` 客户端转 iframe | iframe 16:9 |
| Mux 播放器 | 裸链（player/stream/image.mux.com）→ `rehypeMuxEmbeds` iframe | 同上 |
| 自托管视频文件（.mp4/.webm/.mov） | 裸链或文字==URL 的锚点 → `rehypeMp4Embeds` 原生 `<video controls preload="none">`（2026-10-30 新增） | `.prose video` CSS |
| 交互 embed（`::embed{src height}`） | R2 白名单校验 → sandbox iframe（`data-ai-dive-embed`） | `MermaidContent` resize 监听（注入的 postMessage 脚本）；`<!-- ai-context -->` 注释供文章问答 |
| figure / figcaption | markdown 中直写（博客媒体规范） | `.prose` figure CSS |

## 3. 扩展 checklist（新增媒体类型时逐项过）

轻扩展 = 只产标准 HTML 元素（如本次 video）：通常零页面改动。
重扩展 = 引入定制元素/脚本（如 ::embed）：四个消费方全要碰。

1. **生成物**：新元素是什么标签/结构？是否在 `sanitize: false`（import-post 受信路径）下直出？注意用户内容路径（`src/lib/markdown.ts`，sanitize: true）是否会剥掉它——剥掉是否可接受？
2. **CSS**：`.prose` 下有没有对应样式？（video 先例：`globals.css` 的 `.prose video` 是预先存在的）
3. **客户端后处理**：`MermaidContent` 是否需要认识它（resize、懒加载、链接改写）？
4. **HTML 消费方**：`extract-headings`（TOC 只收 h2-h4，新元素不进来即安全）；`ai-context` 纯文本提取（iframe 内内容要用 `<!-- ai-context -->` 注释补偿）；列表页 excerpt 生成。
5. **渠道构建**：微信/buffett-tribe 消费的是 Vault markdown 源（不是库存 HTML）——新写法在那条链路上的渲染要单独验证（如 ::embed 在微信端会丢，需要兜底链接）。
6. **测试**：`src/lib/*.test.ts` 比照 `markdown-embed.test.ts` / `markdown-video-embed.test.ts` 补用例；`npm run lint && npm test && npm run build` 全绿再交付。

## 4. 纪律

- **单一渲染器**：文章 HTML 只允许 `markdown-pipeline.mjs` 一个工厂产生；页面端不做 markdown 重渲染。
- **只增不替**：管线改动应是词汇表的纯增量。改变既有 markdown 的渲染行为（如标点规则）不会影响存量文章（已冻结），但会造成新旧文章渲染不一致——做这类改动时要有意识地记录。
- **非必要不上 R2**（2026-10-30 用户决策）：能热链/裸链解决的媒体不引入 R2 托管。
