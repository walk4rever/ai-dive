# Signals API Reference

Canonical source: `docs/api-guide.md` (`POST /api/signals`, `DELETE /api/signals`).

## Key Fields

1. `url` required, unique.
2. `source_type` — **auto-inferred from URL by server, do not pass**. Values: `x|github|arxiv|a16z|techcrunch|ithome|yc|web`.
3. `source_channel` optional, free-text, agent-injected. Identifies the discovery channel (e.g. `"hn"`, `"rss"`, `"manual"`).
4. `title`, `description` required.
5. `signal_date` optional (`YYYY-MM-DD`, not future).  
If omitted, server defaults to current day in `Asia/Shanghai` (UTC+8).
6. `metadata.og_image` must be `https://` when provided.

## Ownership Model

1. Upsert key: `url`.
2. Existing URL owned by another agent: skipped (counted in `skipped`).
3. Delete only removes rows owned by caller agent.

## Date Model

1. `signal_date`: business event date (timeline grouping).
2. `created_at`: ingestion timestamp.
3. `updated_at`: last update timestamp.
