-- 2026-10-30 frontmatter 规范化（Vault/FRONTMATTER.md）配套：
-- ai_pulse_stories 的 author_slug/author_display 历史上存的全是「来源名」（20VC/Baseten…），
-- 名实分离：新增 source（来源名）/ author（真实署名作者，可空）/ source_url（原文地址）。
-- 本迁移：加列 + 值搬运 + 值归一。旧列由 20261030_drop_legacy_author_columns.sql 删除。

ALTER TABLE ai_pulse_stories
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 1. 值搬运：旧 author_display（实为来源名）→ source
UPDATE ai_pulse_stories SET source = author_display WHERE source IS NULL;

-- 2. 值归一：同一实体两个 slug
UPDATE ai_pulse_stories SET source = 'Moonshot AI' WHERE author_slug IN ('moonshot-ai', 'moonshots');

-- 3. X 帖聚合：x-* → source 'X.com'，author 落 handle（'X@karpathy' → '@karpathy'）
UPDATE ai_pulse_stories
SET source = 'X.com',
    author = '@' || substring(author_display from 3)
WHERE author_slug LIKE 'x-%';

-- 4. 博客真实署名作者回填（Vault 存档 byline/author 有值的）
UPDATE ai_pulse_stories SET author = 'Elizabeth Goodman'
WHERE slug = 'cuda-13-4-memory-enforced-gpu-sharing';
