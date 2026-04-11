---
name: vault-write
description: Create or update a note in the Claudian Obsidian vault. Use when you learn something that would be useful in a future session on a different day — architecture decisions, reusable patterns, cross-project gotchas, or synthesized insights. Do NOT use for session observations, debugging notes, or user preferences (those belong in claude-mem or session memory).
---

# vault-write

## When to Use

Use for **durable, reusable knowledge** worth finding months from now:
- Architecture decisions (why X was chosen over Y)
- Reusable patterns and techniques
- Cross-project gotchas and integration quirks
- Synthesized insights from multiple sessions
- API/tool behaviour discovered through trial and error

Do **NOT** use for:
- What happened in this session → session memory
- User preferences or mood → claude-mem
- Debugging notes or findings only relevant to the current task

## Steps

**1. Determine note type**

| Type | Use for | Default visibility | Body sections |
|------|---------|-------------------|---------------|
| `knowledge` | Facts, API summaries, tool behaviour | project-only | Summary, Details, References |
| `architecture` | Design decisions, trade-off rationale | project-only | Context, Decision, Consequences, Related |
| `spec` | Specifications, requirements, designs | project-only | Overview, Requirements, Design, Open Questions |
| `pattern` | Reusable code or process patterns | cross-project | Problem, Solution, When to Use, When Not to Use, Known Uses |
| `gotcha` | Bugs, footguns, surprising behaviour | cross-project | The Gotcha, How to Detect, Fix, Prevention |

**2. Check for duplicates** using `vault-search`. If a note on this topic exists, update it — add new content under `## Updates` with the date. Don't create duplicates.

**3. Write with complete frontmatter**

```yaml
---
title: <human-readable title>
type: <knowledge|architecture|spec|pattern|gotcha>
project: <project-name or "cross-project">
tags: [<tag1>, <tag2>]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
source: <claude|human|extracted>
visibility: <project-only|cross-project>
links-to: ["Note Title One", "Note Title Two"]
---
```

For cross-project notes, also add `relevant-to: [<project1>, <project2>]`.

**4. Add wikilinks** — at minimum, link to `[[Project - ProjectName]]` and any directly referenced notes.

**5. Place in the correct folder**

| Type | Folder |
|------|--------|
| `knowledge` | `{vault}/knowledge/` |
| `architecture` | `{vault}/architecture/` |
| `spec`, `pattern`, `gotcha` | `{vault}/knowledge/` |
| project-specific | `{vault}/projects/{project-name}/` |

## File Naming

Kebab-case from the title, strip leading articles (a, an, the).

- "Why We Use CRDT for Sync" → `why-we-use-crdt-for-sync.md`
- "The DataStore Session Lock Pattern" → `datastore-session-lock-pattern.md`

## Quality Gate — Self-Check Before Writing

1. **Would claude-mem capture this?** If it's a preference, observation, or session-specific thing → use claude-mem.
2. **Is this useful on a different day, on a different project?** If only relevant right now → skip it.
3. **Does a duplicate already exist?** → update instead.

Only proceed when all three checks pass.
