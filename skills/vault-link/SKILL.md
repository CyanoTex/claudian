---
name: vault-link
description: Find and create connections between existing vault notes. Use after writing a new note, or when you notice notes that should reference each other but don't.
---

# vault-link

Find and create wikilink connections between notes in the Claudian Obsidian vault.

## When to Use

- After `vault-write` to connect the new note to the graph
- When `vault-status` reports orphan notes
- When the user asks to "link up my notes" or "connect related notes"
- When you notice a note clearly relates to another but doesn't link to it

## How to Link

### Step 1 — Read the Target Note

Understand its topic, type, project, and tags.

### Step 2 — Search for Related Notes

Use multiple strategies: shared tags, similar title terms, same project folder siblings, and adjacent topics by implication (e.g., a DataStore locking note → session, persistence, concurrency notes).

### Step 3 — Propose Links Before Editing

List proposed links with reasoning:

```
From: <source>  →  To: <target>
Reason: <why related>
```

Links are bidirectional when both notes genuinely reference each other's topic. Use one-directional links for asymmetric relationships (e.g., a gotcha cites an ADR, but the ADR doesn't need to know about every gotcha).

### Step 4 — Update Both Notes

For each approved link, add:

1. `[[Note Title]]` in the body at a natural point, or in a `## Related` section
2. The linked title in the `links-to` frontmatter list

```yaml
links-to:
  - "DataStore Session Lock Pattern"
  - "Project - Bloxus"
```

## Wikilink Conventions

| Target | Format |
|--------|--------|
| Regular note | `[[Note Title]]` |
| Project index | `[[Project - ProjectName]]` |
| Note with display text | `[[actual-filename\|Display Text]]` |

Use the exact note title (from `title:` frontmatter or H1) in wikilinks.

## What Makes a Good Link

Link when:
- One note explains a concept the other relies on
- Both notes describe different aspects of the same system or problem
- One note is a specific example of a general pattern in another
- A gotcha explains why an architecture decision was made

Do not link when:
- Notes are only related by being in the same project (that's the project index's job)
- The connection is tenuous or requires many reasoning hops
- Notes share a tag but have unrelated content
