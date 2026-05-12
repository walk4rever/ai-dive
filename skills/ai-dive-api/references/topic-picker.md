# Topic Picker Reference

Daily deep-topic selection workflow. Reads signals and recent posts via API, applies editorial judgment, outputs a ranked pick list for human review.

## When To Use

When the user says "帮我选题"、"今天有什么值得深写的"、"选题报告" or similar.

## Data Sources

### 1. Candidate Signals (via API)

```bash
GET https://ai.air7.fun/api/signals
  ?since={today-5d}          # YYYY-MM-DD, last 5 days
  &insight_min=5             # quality floor (insight OR influence)
  &limit=60
  -H "Authorization: Bearer {agent_api_key}"
```

Returns `{ signals: [...], count: N }`.

If fewer than 5 signals are returned, expand the window (`since={today-14d}`) or lower the floor (`insight_min=3`).

### 2. Recent Posts (for deduplication)

```bash
GET https://ai.air7.fun/api/posts?limit=30
  -H "Authorization: Bearer {agent_api_key}"
```

Extract `slug`, `title`, and note which topics were recently covered. Signals already covered should be deprioritised.

## Selection Algorithm

**Step 1 — Filter**
- Drop signals with `score_status != 'scored'` (not yet scored, no insight data).
- Deprioritise signals whose topic is clearly covered in a recent post title.

**Step 2 — Cluster by theme**
Group remaining candidates by shared topic. Two signals share a theme if they reference the same model name, company, technique, or paper title. A cluster of 2+ signals indicates traction.

**Step 3 — Score clusters**

| Factor | Weight |
|---|---|
| Max `insight` in cluster | high |
| Cluster size (more signals = broader traction) | medium |
| `source_type` depth potential: arxiv > github > hn > twitter | medium |
| Freshness (`signal_date` closer to today) | medium |
| Has concrete numbers / benchmarks in description | low boost |

**Step 4 — Select 1–3 picks**
Pick top clusters. Prefer variety: don't pick two model-release topics on the same day.

## Content Type Routing

| Signal profile | Recommended type |
|---|---|
| arxiv paper, methodology, theory | `analysis` |
| github project + documentation | `case` |
| model release + benchmark data | `analysis` |
| company funding / strategy / market | `invest` |
| product launch, UI/UX, consumer tool | `case` |
| conversation-style topic, opinion | `podcast` |

## Output Format

Respond in Chinese. Structure:

```
## 深度选题报告 {YYYY-MM-DD}

### 选题 {N}：{title}
来源：{N} 条信号 · {source_type} · {signal_date}
为什么选：{2–3 sentences — what happened + why it matters for AI practitioners}
建议分析方向：
  1. {direction}
  2. {direction}
  3. {direction}
建议类型：{analysis | case | invest | podcast}
信号 IDs：{id1}, {id2}, ...

---

### 备选（未入选）
- {title} — {one-line reason not picked}
```

Keep the report concise. 1–3 picks, no more. "备选" is optional; include only if there are strong near-misses worth flagging.

## Notes

- Never query Supabase directly. Always use the API endpoints above.
- Never auto-create posts. Output the report only; the user decides what to write.
- `signal_date` uses Asia/Shanghai (UTC+8). Treat "today" as Shanghai local date.
- `insight_min` and `influence_min` are OR conditions on the server — passing `insight_min=5` returns signals where `insight >= 5` OR `influence >= 6` (server default).
