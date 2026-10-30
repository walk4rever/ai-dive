# intel 已知问题清单

> 2026-10-30 从 blog-pipe X 扫描会话中查出，当时在做「X 帖 Dive 长文 vs intel 情报两条导入路径与新 frontmatter 规范（`source: X.com` + `author: @handle`）的冲突检查」。结论：无硬冲突（import-post.mjs:189-197 与 build_channels.py 均已当日适配），但有以下 3 个待处理问题。**未定方案，找时间再处理。**

## 1. signals 的 upsert 实际不可更新（文档与代码不符）

- `src/app/api/signals/route.ts:174` 用 `ignoreDuplicates: true`：同 url 重复 POST 会被**静默跳过**，不会更新记录。
- 但 blog-pipe 指南 §7.3 写的是「url（X 原链，upsert 键、幂等，只能改自己 agent 的记录）」，语义上暗示重发可修正 description 等字段。
- 实际修正一条 signal 只能先 DELETE 再 POST。
- 待裁定：改代码（去掉 `ignoreDuplicates`）还是改指南条文。

## 2. 来源筛选页新旧 X 帖分组断裂

- `SourceFilterList` 按 `source` 列分组。
- 旧格式兼容分支（import-post.mjs:193-194）：source 落 `X@karpathy` 这种一人一来源。
- 新规范：source 统一落 `X.com`。
- 结果：同一作者的新旧帖子分在两个来源名下，筛选页碎片化。展示层历史遗留，不影响发布。
- 待裁定：是否写迁移把旧 X 帖的 source 统一改成 `X.com`、author 回填 handle。

## 3. 同一条推双发时 `aidive_url` 回写互相覆盖

- 先发 intel 回写 `https://ai.air7fun.com/intels/<date>#signal-<id>`；后升级发 dive 回写 `https://ai.air7fun.com/post/<slug>`。
- Vault frontmatter 只有一个 `aidive_url` 字段，后者覆盖前者，情报页锚点丢失。
- 如果「普通帖先进情报、爆了再升级长文」成为常态需要解决。
- 待裁定：加 `aidive_signal_url` 独立字段，或定回写优先级（如 dive 优先）。
