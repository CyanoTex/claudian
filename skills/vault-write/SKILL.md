---
name: vault-write
description: Create or update a note in the Claudian Obsidian vault. Use when you learn something that would be useful in a future session on a different day — architecture decisions, reusable patterns, cross-project gotchas, or synthesized insights. Do NOT use for session observations, debugging notes, or user preferences (those belong in claude-mem or session memory).
---

# vault-write

Write a new note or update an existing note in the Claudian Obsidian vault.

## When to Use

Use vault-write for **durable, structured, reusable knowledge** — things worth finding months from now:

- Architecture decisions (why X was chosen over Y)
- Reusable patterns (a technique that worked well and will work again)
- Cross-project gotchas (an error, integration quirk, or footgun)
- Synthesized insights (conclusions drawn from multiple sessions)
- API or tool behaviour you discovered through trial and error

Do **NOT** use vault-write for:

- What happened in this session (use session memory)
- The user's current preferences or mood (use claude-mem)
- Debugging notes or temporary findings
- Things only relevant to the current task and no future task

## How to Use

### Step 1 — Determine Note Type

Identify which type of note this content is:

| Type | Use for |
|------|---------|
| `knowledge` | General knowledge, facts, API summaries, tool behaviour |
| `architecture` | Design decisions, system structure, trade-off rationale |
| `spec` | Specifications, requirements, designs |
| `pattern` | Reusable code or process patterns |
| `gotcha` | Bugs, footguns, surprising behaviour, integration quirks |

### Step 2 — Read the Template

Read the corresponding template from `{vault}/meta/templates/`. Use it as the basis for the new note. Templates have required frontmatter fields — fill them all.

### Step 3 — Check for Duplicates

Search the vault before writing. If a note on this topic already exists:
- Update it rather than create a duplicate
- Add new information under a `## Updates` section with the date
- Do not delete existing content unless it is factually wrong

Use `vault-search` to check for duplicates before writing.

### Step 4 — Write with Complete Frontmatter

Every note requires these frontmatter fields:

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
---
```

For cross-project notes, also include:

```yaml
relevant-to: [<project1>, <project2>]
```

### Step 5 — Add Wikilinks

Link to related notes using `[[Note Title]]` syntax. At minimum:
- Link to the project index note: `[[Project - ProjectName]]`
- Link to any notes this note directly references

Add a `links-to` list in the frontmatter:

```yaml
links-to: ["Note Title One", "Note Title Two"]
```

### Step 6 — Place in the Correct Folder

| Type | Folder |
|------|--------|
| `knowledge` | `{vault}/knowledge/` |
| `architecture` | `{vault}/architecture/` |
| `spec` | `{vault}/knowledge/` |
| `pattern` | `{vault}/knowledge/` |
| `gotcha` | `{vault}/knowledge/` |
| project-specific | `{vault}/projects/{project-name}/` |

## File Naming

Use kebab-case derived from the note title. Strip articles (a, an, the) from the start.

Examples:
- "Why We Use CRDT for Sync" → `why-we-use-crdt-for-sync.md`
- "The DataStore Session Lock Pattern" → `datastore-session-lock-pattern.md`
- "Module Require Ordering Gotcha" → `module-require-ordering-gotcha.md`

## Quality Gate — Self-Check Before Writing

Ask yourself these three questions before creating the note:

1. **Would claude-mem capture this?** If it's a user preference, personality observation, or session-specific thing, put it in claude-mem instead.
2. **Is this useful on a different day, on a different project?** If it only matters for the current task right now, skip it.
3. **Does a duplicate already exist?** If yes, update the existing note instead of creating a new one.

If the answer to questions 1 or 3 is yes, stop and use the appropriate tool or update the existing note. Only proceed with a new note when all three checks pass.
