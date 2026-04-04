# vault-seed Design Spec

## Overview

vault-seed is a Claudian skill for bulk-creating a project's initial
knowledge base. When a project is first registered, Claude needs to
populate the vault with 8-10 interconnected notes (architecture, module
map, data flow, patterns, gotchas, etc.). Calling vault-write one note
at a time is slow. vault-seed handles the analyze-propose-write workflow
in a single skill invocation.

## Problem

After running claudian-init and registering a project, the vault has
empty project folders and index stubs. Populating the initial knowledge
base requires creating many interconnected notes. The current vault-write
skill is designed for single notes during normal work — using it 9 times
sequentially is slow because each invocation re-reads the skill prompt.

## Design

### Three Phases

**Phase 1: Analyze**

Scan the project to build a mental model:
- README and existing documentation
- Directory structure and key modules
- CLAUDE.md and project-level docs
- Recent git history (active areas, recent decisions)
- Existing vault notes for this project (avoid duplicates)

From this analysis, determine what knowledge is worth documenting as
durable vault notes.

**Phase 2: Propose**

Present a summary table to the user:

```
Proposed notes for project "my-app":

| # | Title                        | Type         | Folder           |
|---|------------------------------|--------------|------------------|
| 1 | System Architecture Overview | architecture | architecture/    |
| 2 | Module Map                   | knowledge    | projects/my-app/ |
| 3 | Data Flow                    | architecture | architecture/    |
| 4 | Error Handling Pattern        | pattern      | knowledge/       |
| 5 | DataStore Race Condition     | gotcha       | knowledge/       |

Add, remove, or modify? Or approve to write.
```

User can:
- **Approve** — write all notes
- **Add/remove/modify** — adjust the list
- **"Show me #N"** — see full content of a specific note before approving
- **"Show me all"** — see full content of every note (opt-in)

If the user asks to see specific notes, render the full content. Don't
force detail, don't withhold it.

**Phase 3: Write**

Bulk-create all approved notes:
- Use the Write tool directly (not vault-write skill) for speed
- Apply the correct template for each note type
- Complete frontmatter with all required fields
- Cross-link between the new notes (they're created as a set, so all
  link targets are known upfront)
- Update the project index note with links to all new notes
- Quality gate applies per-note: valid types, sources, no ephemera

### Frontmatter

Same schema as vault-write. All notes get:
- `source: claude`
- `project: <project-name>`
- `visibility: project-only` (unless the note is clearly cross-project,
  e.g., a reusable pattern)
- `created` and `updated` set to today

### Cross-Linking

Since all notes are created as a batch, vault-seed knows the full set
of titles upfront. It should:
- Add `[[wikilinks]]` in note bodies where notes reference each other
- Populate the `links-to` frontmatter array
- Link all notes from the project index note

### Quality Gate

Each proposed note passes the same quality gate as vault-write:
- No ephemera (session observations, preferences)
- Valid type, source, visibility values
- No duplicates against existing vault content

### Output

After writing, report what was created:

```
Created 8 notes for project "my-app":
  architecture/system-architecture-overview.md
  architecture/data-flow.md
  projects/my-app/module-map.md
  ...

Project index updated with links to all new notes.
```

## What vault-seed Is NOT

- Not a replacement for vault-write (vault-write is for single notes
  during normal work)
- Not automatic (always requires user approval of the proposed set)
- Not a one-time-only tool (can be re-run to add more notes as the
  project evolves, skipping duplicates)

## Implementation

Single file: `skills/vault-seed/SKILL.md` — a skill markdown file
following the same conventions as the other Claudian skills. No new
core modules or hooks needed.
