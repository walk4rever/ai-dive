-- Store the original markdown source alongside the rendered HTML in `content`.
-- The agent gateway's get_article_content tool reads this column so it gets
-- clean LaTeX formula source instead of rendered KaTeX markup. Nullable —
-- legacy rows fall back to stripping `content` HTML at read time.

ALTER TABLE ai_pulse_stories ADD COLUMN IF NOT EXISTS body_markdown TEXT;
