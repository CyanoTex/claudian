---
name: vault-status
description: Show vault health — orphan notes, stale content, unprocessed ideas, tag coverage, missing frontmatter. Use periodically or when asked about vault state.
---

# vault-status

Report the health of the Claudian Obsidian vault as a concise dashboard.

## When to Use

- User asks "how's the vault?" or "vault status"
- Start of a session to surface maintenance needs
- After a batch of `vault-write` calls to check for orphans
- Before `vault-link` to find what needs linking

## Fresh Vault Detection

If all notes were created today, `knowledge/` and `ideas/` are empty, and only project stubs exist — report it as fresh instead of flagging false issues:

```
VAULT STATUS — {date}

Vault just initialized. No knowledge notes yet.
Projects registered: {list}

Get started:
- Write freeform ideas in {vault}/ideas/ and run /vault-extract
- Use /vault-write when you discover durable knowledge
- The SessionStart hook will surface relevant notes as the vault grows
```

Skip the full dashboard for fresh vaults.

## Checks

Run all checks, then present results as a single dashboard.

**Orphan notes** — no inbound wikilinks from any other vault note. Report count + top 5 by last-updated.

**Stale notes** — `updated` frontmatter more than 30 days old AND linked to by at least one other note. Report count + up to 5 with last-updated date.

**Unprocessed ideas** — files in `{vault}/ideas/` without `processed: true`. Report count + titles and creation dates.

**Tag distribution** — count occurrences per tag across all `tags:` frontmatter blocks. Report top 10 tags and any used only once.

**Project coverage** — count files per `{vault}/projects/{project-name}/`, check for `index.md`. Report as table.

**Missing frontmatter** — notes missing any of: `title`, `type`, `project`, `tags`, `created`, `updated`. Report count + up to 5 with missing fields listed.

## Output Format

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
```

If everything is healthy: "Vault looks healthy — no orphans, no stale notes, all ideas processed."

## Recommended Actions

- Orphans → run `vault-link`
- Unprocessed ideas → run `vault-extract`
- Missing frontmatter → offer to fix with `vault-write` (update mode)
- Stale notes → offer to review and update them
