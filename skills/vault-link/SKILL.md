---
name: vault-link
description: Find and create connections between existing vault notes. Use after writing a new note, or when you notice notes that should reference each other but don't.
---

# vault-link

Find and create wikilink connections between notes in the Claudian Obsidian vault.

## When to Use

- Immediately after running `vault-write` to connect the new note to the graph
- When `vault-status` reports orphan notes (notes with no inbound links)
- When the user asks to "link up my notes" or "connect related notes"
- When you notice while reading a note that it clearly relates to another note but doesn't link to it

## How to Link

### Step 1 — Read the Target Note

Read the note you want to link from (or the newly written note). Understand its topic, type, project, and tags.

### Step 2 — Search for Related Notes

Search the vault for notes that are meaningfully related. Use multiple strategies:

**Shared tags** — notes with overlapping tags are likely related:
```bash
grep -rl "\- <shared-tag>" {vault}/
```

**Similar titles** — search for key terms from the title:
```bash
grep -rl "<key-term>" {vault}/
```

**Same project** — read the project folder for siblings:
```bash
ls {vault}/projects/{project-name}/
```

**Adjacent topics** — think about what this note implies. If it's about DataStore locking, look for notes on sessions, persistence, and concurrency.

### Step 3 — Suggest Wikilinks with Reasoning

Before editing anything, list the proposed links:

```
From: <source note title>  →  To: <target note title>
Reason: <why these notes are related>

From: <target note title>  →  To: <source note title>
Reason: <why the back-link makes sense>
```

Links should be bidirectional when both notes genuinely reference each other's topic. A link is only one-directional when the relationship is asymmetric (e.g., a gotcha note cites an architecture decision, but the architecture note doesn't need to know about every gotcha).

### Step 4 — Update Both Notes

For each approved link, edit the note to add:

1. A `[[Note Title]]` wikilink in the body at a natural point in the text (near the relevant passage, or in a `## Related` section at the bottom)
2. The linked title in the `links-to` frontmatter list

Example frontmatter update:
```yaml
links-to:
  - "DataStore Session Lock Pattern"
  - "Project - Bloxus"
```

Example body addition:
```markdown
## Related

- [[DataStore Session Lock Pattern]]
- [[Project - Bloxus]]
```

## Wikilink Conventions

| Target | Format |
|--------|--------|
| Regular note | `[[Note Title]]` |
| Project index | `[[Project - ProjectName]]` |
| Note with display text | `[[actual-filename|Display Text]]` |

Always use the exact title of the note (as set in frontmatter `title:` or the H1 heading) in the wikilink. Obsidian resolves links by filename, but using the human title ensures readability.

## What Makes a Good Link

Link when:
- One note explains a concept that the other note relies on
- Both notes describe different aspects of the same system or problem
- One note is a specific example of a general pattern described in another
- A gotcha note explains why an architecture decision was made

Do not link when:
- The relationship is only that both notes are in the same project (that's what the project index is for)
- The connection is very tenuous or requires many hops of reasoning
- The notes merely share a tag but have unrelated content
