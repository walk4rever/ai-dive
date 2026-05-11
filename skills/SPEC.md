# Agent Skill Spec (Vendor-Neutral)

This spec defines a portable skill format for any agent runtime (Claude, Codex, Gemini, custom orchestrators).

## Directory Layout

```text
skills/
  SPEC.md
  <skill-name>/
    SKILL.md
    references/
      *.md
    examples/
      *.json | *.sh | *.py
```

## Required: `SKILL.md`

Each skill MUST include:

1. `name`: stable id, kebab-case.
2. `version`: semver string.
3. `purpose`: when this skill should be used.
4. `inputs`: required/optional fields and constraints.
5. `workflow`: step-by-step execution sequence.
6. `outputs`: expected result structure.
7. `errors`: common failures and handling.
8. `sources_of_truth`: canonical docs and schemas.

## Authoring Rules

1. Keep API truth in one place (`docs/api-guide.md`), and link from skills.
2. Keep skill guidance operational: decision rules, request templates, guardrails.
3. Avoid duplicating long field tables unless needed for execution.
4. If examples conflict with canonical docs, docs win.
5. Use explicit timezone/date semantics where relevant.

## Compatibility

Runtime-specific wrappers are allowed (for example `.claude/skills/...`), but MUST point back to `skills/` as canonical.
