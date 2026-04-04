---
name: vault-status
description: Show vault health — orphan notes, stale content, unprocessed ideas, tag coverage, missing frontmatter. Use periodically or when asked about vault state.
---

# vault-status

Report the health of the Claudian Obsidian vault as a concise dashboard.

## When to Use

- The user asks "how's the vault?" or "vault status" or similar
- Periodically at the start of a session to surface maintenance needs
- After a batch of vault-write calls to check for orphans
- Before a vault-link run to find what needs linking

## Fresh Vault Detection

Before running checks, determine if this is a freshly initialized vault:
- All notes were created today (check `created` frontmatter)
- The `knowledge/` and `ideas/` folders are empty
- Only project index stubs exist

If the vault is fresh, report it clearly instead of flagging false issues:

```
VAULT STATUS — {date}

Vault just initialized. No knowledge notes yet.
Projects registered: {list}

Get started:
- Write freeform ideas in {vault}/ideas/ and run /vault-extract
- Use /vault-write when you discover durable knowledge
- The SessionStart hook will surface relevant notes as the vault grows
```

Skip the full dashboard for fresh vaults — orphan and stale checks are meaningless when there's no content yet.

## What to Report

Run all checks and present the results together as a single dashboard. Do not pause between checks.

### 1. Orphan Notes

Notes that have no inbound wikilinks from other vault notes. These are isolated knowledge islands.

Detection: for each note, check whether any other note contains `[[Note Title]]` or `[[filename]]` pointing to it.

Report: count of orphans, list the top 5 by last-updated date.

### 2. Stale Notes

Notes that were last updated more than 30 days ago and are still actively referenced by other notes. These may contain outdated information that other notes are relying on.

Detection: check the `updated` frontmatter field. Flag notes where `updated` is more than 30 days before today's date AND at least one other note links to them.

Report: count of stale notes, list up to 5 with their last-updated date.

### 3. Unprocessed Ideas

Files in `{vault}/ideas/` that do not have `processed: true` in their frontmatter.

Detection: read the ideas folder, check frontmatter of each file.

Report: count of unprocessed ideas, list their titles and creation dates.

### 4. Tag Distribution

How many notes use each tag. Low-count tags may indicate under-tagging or orphan taxonomy entries.

Detection: grep all frontmatter `tags:` blocks, count occurrences per tag.

Report: top 10 tags by count, and any tags used only once.

### 5. Project Coverage

How many notes exist per project, and whether each project has an index note.

Detection: count files per `{vault}/projects/{project-name}/` folder, check for `index.md`.

Report: table of project name, note count, and whether an index note exists.

### 6. Missing Frontmatter

Notes that are missing one or more required frontmatter fields: `title`, `type`, `project`, `tags`, `created`, `updated`.

Detection: read each note's frontmatter and check for missing fields.

Report: count of notes with missing fields, list up to 5 with which fields are missing.

## Output Format

Present the results as a concise dashboard. Use counts prominently so the user can assess severity at a glance:

```
VAULT STATUS — {date}

Orphan notes:        {N}  [list top 5 if N > 0]
Stale notes (>30d):  {N}  [list top 5 if N > 0]
Unprocessed ideas:   {N}  [list all if N > 0]
Missing frontmatter: {N}  [list top 5 if N > 0]

Tag coverage ({total} tags):
  Most used: <tag> ({N}), <tag> ({N}), <tag> ({N})
  Single-use: <tag>, <tag>

Project coverage:
  <project>: {N} notes  [index: yes/no]
  <project>: {N} notes  [index: yes/no]
```

If everything is healthy, say so clearly: "Vault looks healthy — no orphans, no stale notes, all ideas processed."

## Recommended Actions

After presenting the dashboard, suggest next steps if there are issues:

- Orphans → run `vault-link`
- Unprocessed ideas → run `vault-extract`
- Missing frontmatter → offer to fix with `vault-write` (update mode)
- Stale notes → offer to review and update them
