---
name: vault-stub
description: Find wikilinks pointing to non-existent notes and create stub notes for them. Use when Obsidian's graph view shows grey/unresolved nodes, or after bulk writes that may reference notes not yet created.
---

# vault-stub

Scan the vault for broken `[[wikilinks]]` — references in body text that point to notes that don't exist — and create stub notes so they become real nodes in Obsidian's graph.

## When to Use

- Obsidian's graph view shows grey/unresolved nodes
- After `vault-seed` or bulk `vault-write` that may reference not-yet-created notes
- After cross-project linking where one project references another project's concepts
- When `vault-status` reports broken wikilinks

## Phase 1 — Scan

1. Read `~/.claudian/config.yaml` to find the vault path
2. Walk every `.md` file in the vault (exclude `.obsidian/` and `meta/templates/`)
3. For each file, extract:
   - The `title` from frontmatter
   - The filename without extension
   - All `[[wikilinks]]` in body text (not frontmatter, not code blocks)
4. Build a title index: map every existing note title (case-insensitive) and filename to its path
5. For each wikilink target, check if it resolves to an existing note by title or filename match
6. Collect all unresolved targets with the files that reference them

### Skip List

Do not flag these as broken:
- Wikilinks inside fenced code blocks (`` ``` ``) or inline code (`` ` ``)
- Project index self-references (`[[Project - ProjectName]]` in the project's own index)
- Obvious placeholder examples (`[[Note Title]]`, `[[example]]`, `[[Foo]]`, `[[Bar]]`)

## Phase 2 — Propose

Present unresolved wikilinks grouped by inferred project:

```
Broken wikilinks found:

| # | Wikilink Target          | Referenced By                    | Suggested Type | Suggested Folder          |
|---|--------------------------|----------------------------------|----------------|---------------------------|
| 1 | Session Lock Deep Dive   | projects/osrps/data-flow.md      | knowledge      | projects/osrps/           |
| 2 | Rate Limiting Gotcha     | knowledge/api-patterns.md        | gotcha         | knowledge/                |

Create stubs? Approve, modify, or skip individual entries.
```

**Type inference rules:**
- Target title contains "gotcha", "pitfall", "trap", "footgun" → `gotcha`
- Target title contains "pattern", "technique", "approach" → `pattern`
- Target title contains "architecture", "design", "system" → `architecture`
- Target appears in a project-specific note → same project, `knowledge` type
- Target appears in `knowledge/` or `architecture/` → `knowledge` type
- Default: `knowledge`

**Folder inference rules:**
- If all referencing notes are from one project → `projects/{project}/`
- If referenced by notes from multiple projects → `knowledge/`
- Architecture-type stubs → `architecture/`

Wait for user approval before proceeding.

## Phase 3 — Create Stubs

For each approved stub:

1. **Read the template** from `{vault}/meta/templates/` matching the inferred type

2. **Write frontmatter:**

```yaml
---
title: "{wikilink target text}"
type: {inferred type}
project: {inferred project or cross-project}
source: claude
tags: [{inferred from referencing notes — use shared tags}]
created: "{today YYYY-MM-DD}"
updated: "{today YYYY-MM-DD}"
visibility: {project-only if single project, cross-project if multi}
links-to: ["{titles of notes that reference this stub}"]
---
```

3. **Write a minimal body** following the template structure. Mark sections that need fleshing out:

```markdown
## Summary

Stub created from broken wikilink in [[Referencing Note Title]]. This note needs content.

## Details

<!-- TODO: flesh out this stub -->

## References

- [[Referencing Note Title]]
```

For `gotcha` type, use the gotcha template sections (`## The Gotcha`, `## How to Detect`, etc.) with TODO markers.
For `pattern` type, use the pattern template sections (`## Problem`, `## Solution`, etc.) with TODO markers.

4. **Name the file** using kebab-case from the wikilink target title, stripping leading articles.

5. **Update the project index** — append the new stub to `{vault}/projects/{project}/index.md` under `## Notes`, marked as a stub:
   - `[[Note Title]] — stub, needs content`

6. **Add backlinks** — in the referencing note(s), update `links-to` frontmatter to include the new stub's title (if not already present).

## Phase 4 — Report

```
Created {N} stub notes:
  projects/osrps/session-lock-deep-dive.md (stub)
  knowledge/rate-limiting-gotcha.md (stub)

Stubs need content — use vault-write to flesh them out, or let the
vault-gardener flag them for review.
```

## Quality Rules

- Stubs pass the same frontmatter validation as vault-write (required fields, valid enums)
- Stubs are never cross-project unless referenced by multiple projects
- Never overwrite an existing note — if a file exists at the target path, skip it
- Tags are inferred from the referencing notes' tags (intersection of shared tags, minimum 1)
- If no tags can be inferred, use the referencing note's project name as a tag
