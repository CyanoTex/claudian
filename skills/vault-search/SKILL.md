---
name: vault-search
description: Search the Claudian Obsidian vault by content, tags, project, or note type. Use when you need context from the vault, when the SessionStart hook surfaced relevant notes, or when the UserPromptSubmit hook nudged you toward vault content.
---

# vault-search

## When to Use

- SessionStart or UserPromptSubmit hook surfaced potentially relevant notes
- You need prior context before writing code or making a decision
- You are about to use vault-write and want to check for duplicates

## Vault Layout

- `{vault}/projects/{project-name}/` — all notes for a project
- `{vault}/projects/{project-name}/index.md` — project summary and note links
- `{vault}/knowledge/` — cross-project notes

## Frontmatter Fields

- `tags:` — inline (`tags: datastore, sessions`) or YAML list
- `type:` — one of `architecture`, `pattern`, `gotcha`, `insight`, `reference`

## Structured Query Syntax

Queries from users or hooks may use this format:

```
tag:<tagname> project:<project-name> type:<note-type> "<freetext>"
```

Examples:
- `tag:datastore project:bloxus` — DataStore notes in the Bloxus project
- `type:gotcha "require ordering"` — gotcha notes containing "require ordering"

Decompose into components and run the appropriate searches.

## Obsidian CLI

If `obsidian` is on PATH, prefer it:

```bash
obsidian search query="<your query>" format=json
```

Parse the JSON response to extract titles, paths, and snippets.

## Output Format

Present results as a summary table:

| Title | Type | Tags | Path |
|-------|------|------|------|
| DataStore Session Lock | pattern | datastore, sessions | projects/bloxus/datastore-session-lock.md |

Then ask which notes to open, or read the most relevant ones immediately if context makes the right choice obvious. Always read the full note — do not truncate or summarize frontmatter.
