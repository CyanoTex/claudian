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

Scan the project:

1. **README and docs** — README, docs/, CLAUDE.md
2. **Directory structure** — `ls` root and key subdirectories
3. **Key modules** — entry points, core modules, config files
4. **Git history** — `git log --oneline -20`
5. **Existing vault notes** — `{vault}/projects/{project-name}/` (avoid duplicates)

Identify durable knowledge worth capturing:
- Architecture and why it's structured that way
- Key modules and how they connect
- Data flow
- Reusable patterns
- Gotchas and footguns
- Technical decisions and rationale

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

User can approve, add, remove, modify, or request previews ("Show me #N" / "Show me all"). When previewing, render complete note content (frontmatter + body) as it would be written. For 8+ notes, offer to show in groups of 3-4 instead of all at once.

Do NOT proceed to Phase 3 without explicit approval.

## Phase 3: Write

Bulk-create all approved notes using the Write tool directly (not vault-write):

### For each note:

1. **Read the template** from `{vault}/meta/templates/` matching the note type. Fall back to the plugin's `templates/` folder. Use the actual file — do not invent structure from memory.

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

- `source: claude` for all seed notes
- `visibility: project-only` by default; `cross-project` only for patterns/gotchas that clearly generalize
- Cross-project notes: set `project: cross-project`, populate `relevant-to` with at minimum the current project
- Populate `links-to` with other notes in this batch that this note references

3. **Write the body** per the template. Use `[[wikilinks]]` to other batch notes wherever referenced.

4. **Name the file** kebab-case from the title, stripping leading articles (a, an, the):
   - "Why We Use CRDT for Sync" → `why-we-use-crdt-for-sync.md`
   - "The DataStore Session Lock Pattern" → `datastore-session-lock-pattern.md`

5. **Place in the correct folder:**
   - `knowledge`, `spec`, `pattern`, `gotcha` → `{vault}/knowledge/`
   - `architecture` → `{vault}/architecture/`
   - Project-internal notes → `{vault}/projects/{project-name}/`

### After all notes are written:

6. **Update the project index** at `{vault}/projects/{project-name}/index.md` — append wikilinks to every new note under `## Notes`. Don't replace existing links. Create the section if absent.

## Phase 4: Verify

After all notes are written, dispatch the `vault-reviewer` agent on the newly created notes. vault-reviewer reports findings back to you — it does not modify notes itself. You apply the fixes.

1. Dispatch vault-reviewer with the list of written note paths
2. Read its report. If it flags issues (broken wikilinks, missing frontmatter, ephemera, type violations), fix them yourself
3. Re-run vault-reviewer on the affected notes to confirm fixes
4. If the same issue persists after two fix attempts, surface it to the user rather than looping again

Write → review → fix loop must complete before surfacing results to the user.

**Report after verification passes:**

```
Created {N} notes for project "{project-name}":
  architecture/system-architecture-overview.md
  architecture/data-flow.md
  projects/{name}/module-map.md
  knowledge/error-handling-pattern.md
  knowledge/session-lock-race-condition.md

Project index updated. All notes passed vault-reviewer.
```

## Quality Gate

Each note must pass before Phase 4 review:

- **No ephemera** — no session observations, debugging steps, or user preferences
- **Valid types** — knowledge, architecture, spec, pattern, gotcha
- **Valid source** — claude (for seed notes)
- **Valid visibility** — project-only or cross-project
- **No duplicates** — skip any note whose title already exists; report it as skipped

## Re-Running vault-seed

vault-seed can be run again on the same project. On subsequent runs:
- Phase 1 includes existing vault notes
- Phase 2 skips topics already covered
- Phase 3 only writes genuinely new notes
- Existing notes are never overwritten — use vault-write to update them
