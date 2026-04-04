---
name: vault-seed
description: Bulk-create a project's initial knowledge base in the Claudian vault. Analyzes the project codebase, proposes a set of interconnected notes, and writes them after user approval. Use when a project is first registered or when you need to populate a project's vault presence from scratch.
---

# vault-seed

Populate a project's vault presence by analyzing its codebase and bulk-creating interconnected notes.

## When to Use

- A project was just registered with Claudian and has empty or stub-only vault folders
- The user asks to "seed", "populate", or "bootstrap" a project's knowledge base
- A project has significant undocumented architecture, patterns, or gotchas

Do NOT use for adding a single note during normal work — that's vault-write.

## Phase 1: Analyze

Scan the project to understand what's worth documenting:

1. **README and docs** — read the project README, any docs/ folder, CLAUDE.md
2. **Directory structure** — `ls` the project root and key subdirectories to understand module layout
3. **Key modules** — read the entry points, core modules, and any configuration files
4. **Git history** — `git log --oneline -20` to see recent activity and active areas
5. **Existing vault notes** — check `{vault}/projects/{project-name}/` for notes that already exist (avoid duplicates)

From this analysis, identify durable knowledge worth capturing:
- How the system is architected and why
- What the key modules do and how they connect
- Data flow through the system
- Reusable patterns the project uses
- Gotchas and footguns discovered in the code or git history
- Technical decisions and their rationale

## Phase 2: Propose

Present a summary table of proposed notes:

```
Proposed notes for project "{project-name}":

| # | Title                        | Type         | Folder           |
|---|------------------------------|--------------|------------------|
| 1 | System Architecture Overview | architecture | architecture/    |
| 2 | Module Map                   | knowledge    | projects/{name}/ |
| 3 | Data Flow                    | architecture | architecture/    |
| 4 | Error Handling Pattern        | pattern      | knowledge/       |
| 5 | Session Lock Race Condition  | gotcha       | knowledge/       |

Add, remove, or modify? Or approve to write.
```

Wait for the user's response. They can:

- **Approve** — say "looks good", "go ahead", "write it" → proceed to Phase 3
- **Add** — "also add a note about the networking layer" → add to the list, re-present
- **Remove** — "skip #3, we're rethinking that" → remove, re-present
- **Modify** — "make #4 a gotcha instead of a pattern" → adjust, re-present
- **"Show me #N"** — request full content preview of a specific note before approving
- **"Show me all"** — request full content preview of every proposed note

If the user asks to see specific notes, render the complete note content (frontmatter + body) exactly as it would be written to the vault. Do not force detail on the user, but do not withhold it when asked. For large batches (8+ notes), if the user asks to "show me all," warn that this will be lengthy and offer to show them in groups of 3-4 instead.

Do NOT proceed to Phase 3 without explicit approval.

## Phase 3: Write

Bulk-create all approved notes using the Write tool directly (not the vault-write skill):

### For each note:

1. **Read the template** from `{vault}/meta/templates/` matching the note type. If templates aren't in the vault, use the plugin's `templates/` folder. Read the actual template file and use it as the basis for the note — do not invent a structure from memory.

2. **Write complete frontmatter:**

```yaml
---
title: "{note title}"
type: {knowledge|architecture|pattern|gotcha|spec}
project: {project-name|cross-project}
source: claude
tags: [{relevant tags}]
created: "{today YYYY-MM-DD}"
updated: "{today YYYY-MM-DD}"
visibility: {project-only|cross-project}
relevant-to: [{projects this note is relevant to, if cross-project}]
links-to: [{titles of other notes in this batch that this note references}]
---
```

- Use `source: claude` for all seed notes
- Use `visibility: project-only` by default; use `cross-project` only for patterns and gotchas that clearly apply beyond this project
- For cross-project notes, set `project: cross-project` and populate `relevant-to` with the project names this note is relevant to (at minimum, the current project)
- Populate `links-to` with titles of other notes in the batch that this note references

3. **Write the body** following the template structure. Include `[[wikilinks]]` to other notes in the batch wherever they're referenced.

4. **Name the file** using kebab-case derived from the title. Strip leading articles (a, an, the).
   - "Why We Use CRDT for Sync" → `why-we-use-crdt-for-sync.md`
   - "The DataStore Session Lock Pattern" → `datastore-session-lock-pattern.md`
   - "Module Require Ordering Gotcha" → `module-require-ordering-gotcha.md`

5. **Place in the correct folder** (same rules as vault-write):
   - `knowledge` type → `{vault}/knowledge/`
   - `architecture` type → `{vault}/architecture/`
   - `spec` type → `{vault}/knowledge/`
   - `pattern` type → `{vault}/knowledge/`
   - `gotcha` type → `{vault}/knowledge/`
   - Project-specific notes that are truly only about this project's internals → `{vault}/projects/{project-name}/`

### After all notes are written:

6. **Update the project index** at `{vault}/projects/{project-name}/index.md` — append wikilinks to every new note under the existing `## Notes` section. Do not replace existing links — add new ones alongside them. If there is no `## Notes` section, create it.

7. **Report what was created:**

```
Created {N} notes for project "{project-name}":
  architecture/system-architecture-overview.md
  architecture/data-flow.md
  projects/{name}/module-map.md
  knowledge/error-handling-pattern.md
  knowledge/session-lock-race-condition.md

Project index updated with links to all new notes.
```

## Quality Gate

Each note in the batch must pass the same checks as vault-write:

- **No ephemera** — no session observations, debugging steps, or user preferences
- **Valid types** — must be one of: knowledge, architecture, spec, pattern, gotcha
- **Valid source** — must be: claude (for seed notes)
- **Valid visibility** — must be: project-only or cross-project
- **No duplicates** — if a note with the same title already exists in the vault, skip it and report that it was skipped

## Re-Running vault-seed

vault-seed can be run again on the same project. On subsequent runs:
- Phase 1 analysis includes existing vault notes
- Phase 2 proposal skips topics already covered by existing notes
- Phase 3 only writes genuinely new notes
- Existing notes are never overwritten — use vault-write to update them
