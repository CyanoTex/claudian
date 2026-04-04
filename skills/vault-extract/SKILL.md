---
name: vault-extract
description: Process the user's freeform notes in the vault's ideas/ folder into structured knowledge notes. Use when SessionStart flags unprocessed ideas, or when the user asks you to look at their ideas.
---

# vault-extract

Extract structured knowledge notes from the user's freeform ideas in the vault's `ideas/` folder.

## The ideas/ Folder

The `ideas/` folder belongs entirely to the user. It is their private scratchpad — freeform writing, raw thoughts, half-formed plans. Claude reads this folder but **NEVER writes directly into it**. The only exception is setting `processed: true` in frontmatter after the user approves extraction, which requires explicit user approval first.

## When to Use

- SessionStart flagged one or more notes in `ideas/` that don't have `processed: true`
- The user says something like "look at my ideas" or "process my notes"
- The user asks Claude to turn a rough idea into a structured note

## Extraction Flow

### Step 1 — Read the Idea

Read the idea file in full. Understand what the user was capturing — the domain, the problem, the insight, the question.

### Step 2 — Identify Extractable Knowledge

Determine what structured knowledge lives inside this idea. One idea may yield multiple notes. Look for:

- A decision that was made (→ `architecture` note)
- A technique that worked (→ `pattern` note)
- A surprising behaviour or failure (→ `gotcha` note)
- A conclusion about something (→ `insight` note)

Some ideas are purely speculative or to-do — these don't need extraction, just flag them as processed with a note explaining why.

### Step 3 — Propose Structured Notes

Show the user exactly what would be created before creating anything. For each proposed note, show:

```
Proposed note: <title>
Type: <type>
Folder: <destination folder>
Tags: [<tags>]
Summary: <1-2 sentence description of the content>
```

If multiple notes would be created, list all of them together before asking for approval.

### Step 4 — Wait for User Approval

**Always wait.** Do not create any notes until the user explicitly approves. This is not optional.

Say something like: "Ready to create these N notes. Should I go ahead, or would you like to adjust anything first?"

If the user wants changes, revise the proposal and show it again before proceeding.

### Step 5 — Create the Approved Notes

Use `vault-write` for each approved note. Follow all vault-write conventions:
- Complete frontmatter including `source: extracted`
- Correct folder placement
- Wikilinks to related notes
- Kebab-case filename from title

### Step 6 — Flag the Original Idea

After all notes are created, update the original idea file's frontmatter:

```yaml
processed: true
extracted-to:
  - "Title of First Note"
  - "Title of Second Note"
```

If the idea was skipped (no extractable knowledge), still mark it:

```yaml
processed: true
extracted-to: []
extraction-note: "Speculative — no durable knowledge to extract yet"
```

## Key Rules

- **Never skip Step 4.** Always show the proposal and wait for approval.
- **Never write into ideas/.** Only update frontmatter of existing idea files, and only after approval.
- **Never delete ideas.** Even after extraction, the original idea stays intact.
- **One vault-write call per note.** Do not batch multiple notes into a single file.
- If an idea is ambiguous, ask the user for clarification before proposing notes — do not guess.
