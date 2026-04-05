---
name: vault-stub
description: This skill should be used when the user asks to "fix broken wikilinks", "create missing notes", "fill grey nodes", "stub out missing notes", "resolve unlinked references", or when Obsidian's graph view shows unresolved nodes after vault-seed or bulk vault-write operations.
version: 0.1.0
---

# vault-stub

Scan the vault for broken `[[wikilinks]]` — references in body text that point to notes that don't exist — and create stub notes so they become real nodes in Obsidian's graph.

## When to Use

- Obsidian's graph view shows grey/unresolved nodes
- After `vault-seed` or bulk `vault-write` that may reference not-yet-created notes
- After cross-project linking where one project references another project's concepts
- When `vault-status` reports broken wikilinks

## Phase 1 — Scan

1. Load `~/.claudian/config.yaml` to find the vault path
2. Walk every `.md` file in the vault (exclude `.obsidian/` and `meta/templates/`)
3. For each file, extract:
   - The `title` from frontmatter
   - The filename without extension
   - All `[[wikilinks]]` in body text (not frontmatter, not code blocks)
4. Build a title index mapping every existing note title (case-insensitive) and filename to its path
5. Check each wikilink target against the index for title or filename match
6. Collect all unresolved targets with the files that reference them

### Skip List

Do not flag these as broken:
- Wikilinks inside fenced code blocks (`` ``` ``) or inline code (`` ` ``)
- Project index self-references (`[[Project - ProjectName]]` in the project's own index)
- Wikilinks under 4 characters or matching common placeholder patterns (`[[Foo]]`, `[[Bar]]`, `[[example]]`, `[[Note Title]]`)

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
- Title contains "gotcha", "pitfall", "trap", "footgun" → `gotcha`
- Title contains "pattern", "technique", "approach" → `pattern`
- Title contains "architecture", "design", "system" → `architecture`
- Target appears in a project-specific note → same project, `knowledge` type
- Default: `knowledge`

**Folder inference rules:**
- All referencing notes from one project → `projects/{project}/`
- Referenced by notes from multiple projects → `knowledge/`
- Architecture-type stubs → `architecture/`

Wait for user approval before proceeding.

## Phase 3 — Create Stubs

For each approved stub:

1. Read the template from `{vault}/meta/templates/` matching the inferred type.

2. Assemble frontmatter:

```yaml
---
title: "{wikilink target text}"
type: {inferred type}
project: {inferred project or cross-project}
source: claude
tags: [{inferred from referencing notes — shared tags, minimum 1}]
created: "{today YYYY-MM-DD}"
updated: "{today YYYY-MM-DD}"
visibility: {project-only if single project, cross-project if multi}
links-to: ["{titles of notes that reference this stub}"]
---
```

3. Write a minimal body following the template structure, with TODO markers for content:

```markdown
## Summary

Stub — referenced by [[Referencing Note Title]]. Needs content.

## Details

<!-- TODO: flesh out this stub with vault-write -->

## References

- [[Referencing Note Title]]
```

For `gotcha` type, use the gotcha template sections (`## The Gotcha`, `## How to Detect`, etc.) with TODO markers.
For `pattern` type, use the pattern template sections (`## Problem`, `## Solution`, etc.) with TODO markers.

4. Name the file using kebab-case from the wikilink target title, stripping leading articles.

5. Append the new stub to `{vault}/projects/{project}/index.md` under `## Notes`:
   - `[[Note Title]] — stub, needs content`

6. In the referencing note(s), add the stub's title to `links-to` frontmatter if not already present.

## Phase 4 — Report

```
Created {N} stub notes:
  projects/osrps/session-lock-deep-dive.md (stub)
  knowledge/rate-limiting-gotcha.md (stub)

Stubs need content — flesh out with vault-write or let vault-gardener flag for review.
```

## Quality Rules

- Stubs pass the same frontmatter validation as vault-write (required fields, valid enums)
- Stubs are never cross-project unless referenced by multiple projects
- Never overwrite an existing note — skip if a file exists at the target path
- Infer tags from referencing notes' tags (intersection of shared tags, minimum 1)
- If no tags can be inferred, use the referencing note's project name as a tag
