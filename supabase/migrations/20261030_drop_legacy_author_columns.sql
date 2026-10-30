-- 2026-10-30 frontmatter 规范化第二步：全链路切到 source/author/source_url 后，
-- 删除历史遗留的 author_slug / author_display（其值已搬入 source，见
-- 20261030_add_source_author_source_url.sql）。
-- ⚠️ 必须先部署使用新列的代码，再执行本迁移。

ALTER TABLE ai_pulse_stories
  DROP COLUMN IF EXISTS author_slug,
  DROP COLUMN IF EXISTS author_display;
