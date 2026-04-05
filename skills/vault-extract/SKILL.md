---
name: vault-extract
description: Process the user's freeform notes in the vault's ideas/ folder into structured knowledge notes. Use when SessionStart flags unprocessed ideas, or when the user asks you to look at their ideas.
---

# vault-extract

Extract structured knowledge notes from freeform ideas in the vault's `ideas/` folder.

## The ideas/ Folder

`ideas/` belongs entirely to the user — their private scratchpad. Claude reads it but **NEVER writes into it**. The only write allowed is setting `processed: true` in frontmatter after explicit user approval.

## When to Use

- SessionStart flagged notes in `ideas/` without `processed: true`
- User says "look at my ideas" or "process my notes"

## Extraction Flow

**1. Read the idea.** Understand what the user was capturing.

**2. Identify extractable knowledge.** One idea may yield multiple notes:
- Decision made → `architecture` note
- Technique that worked → `pattern` note
- Surprising behaviour/failure → `gotcha` note
- Conclusion or synthesis → `knowledge` note

Purely speculative or to-do ideas don't need extraction — just flag them processed with a note explaining why.

**3. Propose structured notes.** Show the user what would be created before creating anything:

```
Proposed note: <title>
Type: <type>
Folder: <destination folder>
Tags: [<tags>]
Summary: <1-2 sentence description>
```

List all proposals together before asking for approval.

**4. Wait for approval.** Always. Ask: "Ready to create these N notes. Should I go ahead, or would you like to adjust anything first?" Revise and re-show if changes are requested.

**5. Create approved notes.** Use `vault-write` for each. Set `source: extracted` in frontmatter. One call per note — never batch.

**6. Flag the original idea.** Update its frontmatter after all notes are created:

```yaml
processed: true
extracted-to:
  - "Title of First Note"
```

If skipped (no extractable knowledge):

```yaml
processed: true
extracted-to: []
extraction-note: "Speculative — no durable knowledge to extract yet"
```

## Key Rules

- **Never skip approval.** Always show the proposal and wait.
- **Never write into ideas/.** Only update frontmatter of existing files, only after approval.
- **Never delete ideas.** Originals stay intact after extraction.
- **One vault-write call per note.** Do not batch multiple notes into a single file.
- **Always use `source: extracted`.** Never `claude` or `human` for notes extracted from ideas.
- If an idea is ambiguous, ask for clarification before proposing — do not guess.
