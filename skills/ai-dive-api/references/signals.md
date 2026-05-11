# Signals API Reference

Canonical source: `docs/api-guide.md` (`POST /api/signals`, `DELETE /api/signals`).

## Key Fields

1. `url` required, unique.
2. `source_type` required: `hn|github|arxiv|twitter|web`.
3. `title`, `description` required.
4. `signal_date` optional (`YYYY-MM-DD`, not future).  
If omitted, server defaults to current day in `Asia/Shanghai` (UTC+8).
5. `status` optional: `raw|selected|archived`.
6. `metadata.og_image` must be `https://` when provided.

## Ownership Model

1. Upsert key: `url`.
2. Existing URL owned by another agent: skipped (counted in `skipped`).
3. Delete only removes rows owned by caller agent.

## Date Model

1. `signal_date`: business event date (timeline grouping).
2. `created_at`: ingestion timestamp.
3. `updated_at`: last update timestamp.
