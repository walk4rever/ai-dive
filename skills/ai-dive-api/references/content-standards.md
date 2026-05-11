# Content Standards Reference

Canonical source: `docs/api-guide.md` (`内容规范` section).

## Intel Workflow

1. Inject signals via `POST /api/signals`.
2. Publish daily intel overview via `POST /api/posts` with `type: "intel"`.

## Signal Summary Requirements

1. Chinese summary, concise and synthesized.
2. Include:
what happened + why it matters.
3. Avoid raw tweet/thread artifacts.
