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

### Step 0: Check for existing manifest

Before writing anything, check for `{vault}/projects/{project}/seed-manifest.json`. If it exists:

1. Read the manifest and show a status summary:
   ```
   Existing vault-seed progress for "{project}":
     Created: 3 notes
     Deferred: 2 notes (user said "not now")
     Pending: 1 note (not yet offered)
     Skipped: 0 notes

   Resume from where you left off? (yes / start fresh)
   ```
2. If "yes": skip Phase 1 and 2, go directly to Step 2 with the manifest's note list. Skip notes with status `created` or `skipped`.
3. If "start fresh": delete the manifest and proceed normally from Phase 1.

### Step 1: Write the project index first

Update `{vault}/projects/{project-name}/index.md` under `## Notes` with **planned links** for every approved note. Each entry is a wikilink with an inline description:

```
- [[System Architecture Overview]] — overall architecture, filesystem-first design, capability escalation
- [[Module Map]] — the 5 core modules, their responsibilities, and dependency graph
- [[Data Flow]] — hook-to-skill data pipeline, cache pointer handoff
```

The description explains what the note should contain. Don't replace existing links. Create the section if absent. The index is always written **before** any content notes.

After writing the index, create `{vault}/projects/{project}/seed-manifest.json`:

```json
{
  "created": "YYYY-MM-DD",
  "project": "{project}",
  "notes": [
    { "title": "Note Title", "status": "pending", "path": null }
  ]
}
```

All notes start as `pending`.

### Step 2: Offer each note individually

For each planned link in the index, ask the user:

```
Create [[System Architecture Overview]]?
  → overall architecture, filesystem-first design, capability escalation
  (yes / not now / skip all)
```

- **"Yes"** → proceed to Step 3 for this note
- **"Not now"** → leave the planned link in the index, move to the next note
- **"Skip all"** → stop offering, leave remaining planned links for a future session

After each user decision, update the manifest:
- "Yes" + note created → set status to `created`, set path to the written file path
- "Not now" → set status to `deferred`
- "Skip all" → set remaining `pending` notes to `skipped`

When all notes are `created` or `skipped` (no `pending` or `deferred`), delete the manifest.

### Step 3: Create the note

For each approved note, dispatch the `vault-seed-worker` agent with:

- The vault path
- The note's title, type, project, tags, visibility, folder, and filename
- The **description from the planned link** as content guidance
- The template file for the note type (read from `{vault}/meta/templates/`, fall back to plugin's `templates/`)
- The codebase path so the worker can read relevant source files

**Frontmatter rules for the dispatch payload:**
- `source: claude` for all seed notes
- `visibility: project-only` by default; `cross-project` only for patterns/gotchas that clearly generalize
- Cross-project notes: set `project: cross-project`, populate `relevant-to` with at minimum the current project
- Populate `links-to` with titles of existing vault notes this note will reference

The worker reads the codebase, writes the note with real content, and reports back.

**Naming:** kebab-case from the title, stripping leading articles (a, an, the):
- "Why We Use CRDT for Sync" → `why-we-use-crdt-for-sync.md`
- "The DataStore Session Lock Pattern" → `datastore-session-lock-pattern.md`

**Placement:**
- `knowledge`, `spec`, `pattern`, `gotcha` → `{vault}/knowledge/`
- `architecture` → `{vault}/architecture/`
- Project-internal notes → `{vault}/projects/{project-name}/`

### Step 4: Update the index entry

After the worker confirms the note was written, the planned link in the index is now a real link — no changes needed since the wikilink text is identical. The planned link resolves naturally once the note file exists.

## Phase 4: Verify

After all notes are written, dispatch the `vault-reviewer` agent on the newly created notes. vault-reviewer reports findings back to you — it does not modify notes itself. You apply the fixes.

1. Dispatch vault-reviewer with the list of written note paths
2. Read its report. If it flags issues (broken wikilinks, missing frontmatter, ephemera, type violations), fix them yourself
3. Re-run vault-reviewer on the affected notes to confirm fixes
4. If the same issue persists after two fix attempts, surface it to the user rather than looping again

Write → review → fix loop must complete before surfacing results to the user.

**Report after verification passes:**

```
Seeded project "{project-name}":
  Created {N} notes:
    architecture/system-architecture-overview.md
    projects/{name}/module-map.md
    knowledge/error-handling-pattern.md

  Planned (deferred for later):
    [[Data Flow]] — hook-to-skill data pipeline, cache pointer handoff
    [[Session Lock Race Condition]] — gotcha with concurrent session writes

  All created notes passed vault-reviewer.
```

## Quality Gate

Each note must pass before Phase 4 review:

- **No ephemera** — no session observations, debugging steps, or user preferences
- **Valid types** — knowledge, architecture, spec, pattern, gotcha
- **Valid source** — claude (for seed notes)
- **Valid visibility** — project-only or cross-project
- **No duplicates** — skip any note whose title already exists; report it as skipped
- **No dangling wikilinks in content notes** — every `[[wikilink]]` in a note body must resolve to an existing vault note or a note written earlier in this batch. Planned links in the index (with ` — ` descriptions) are allowed — see [[Dangling Wikilink Anti-Pattern]]

## Re-Running vault-seed

vault-seed can be run again on the same project. On subsequent runs:
- Phase 1 includes existing vault notes
- Phase 2 skips topics already covered
- Phase 3 only writes genuinely new notes
- Existing notes are never overwritten — use vault-write to update them
