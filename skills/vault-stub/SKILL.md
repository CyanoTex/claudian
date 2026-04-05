---
name: vault-stub
description: This skill should be used when the user asks to "fix broken wikilinks", "create missing notes", "fill grey nodes", "stub out missing notes", "resolve unlinked references", or when Obsidian's graph view shows unresolved nodes after vault-seed or bulk vault-write operations.
version: 0.3.0
---

# vault-stub

Scan the vault for broken `[[wikilinks]]` and coordinate with project-context Claude sessions to resolve them with real content — not empty stubs.

vault-stub is a **coordination skill**. It identifies what's missing, then dispatches the actual writing to Claude sessions that have the codebase context to produce meaningful notes. See [[Dangling Wikilink Anti-Pattern]].

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
7. For each unresolved target, check if the referencing line has a description after ` — `. If so, mark it as a **planned link** and capture the description

### Skip List

Do not flag these as broken:
- Wikilinks inside fenced code blocks (`` ``` ``) or inline code (`` ` ``)
- Project index self-references (`[[Project - ProjectName]]` in the project's own index)
- Wikilinks under 4 characters or matching common placeholder patterns (`[[Foo]]`, `[[Bar]]`, `[[example]]`, `[[Note Title]]`)
- Template-style placeholders containing hyphens as word separators with no spaces (`[[pattern-name]]`, `[[project-name]]`) or generic variable-like names (`[[Project - ProjectName]]`)

## Phase 2 — Propose

Present unresolved wikilinks grouped by project. Distinguish planned links (have descriptions) from bare broken links:

```
Unresolved wikilinks found:

Planned (have descriptions):
| # | Wikilink Target          | Description                              | Project   | Inferred Type |
|---|--------------------------|------------------------------------------|-----------|---------------|
| 1 | System Architecture      | overall architecture, filesystem-first   | claudian  | architecture  |
| 2 | Module Map               | the 5 core modules and dependency graph  | claudian  | knowledge     |

Bare (no description — may be accidental):
| # | Wikilink Target          | Referenced By                    | Project   | Inferred Type |
|---|--------------------------|----------------------------------|-----------|---------------|
| 3 | Rate Limiting Gotcha     | knowledge/api-patterns.md        | (cross)   | gotcha        |

Approve to dispatch, modify, or skip individual entries.
```

**Type inference rules:**
- Title contains "gotcha", "pitfall", "trap", "footgun" → `gotcha`
- Title contains "pattern", "technique", "approach" → `pattern`
- Title contains "architecture", "design", "system" → `architecture`
- Target appears in a project-specific note → same project, `knowledge` type
- Default: `knowledge`

**Project inference:**
- All referencing notes from one project → that project
- Referenced by notes from multiple projects → cross-project
- Check `project` frontmatter in referencing notes

Wait for user approval before proceeding.

## Phase 3 — Dispatch

vault-stub does **not** write notes itself for other projects. It coordinates with Claude sessions that have the codebase context to produce meaningful content.

### Current project (cwd matches a registered project)

If broken wikilinks belong to the project you're currently working in, you have the codebase context. Write the notes directly using vault-write, with real content derived from reading the relevant code and docs.

### Other projects

1. If claudy-talky is unavailable (MCP server not running), treat all other-project wikilinks as "no session found" and skip to step 3.
2. Use claudy-talky `list_agents` to find Claude sessions running in the relevant project's working directory.
3. **Session found:** Use `handoff_work` to send the note-writing task, including:
   - The wikilink target (note title)
   - The inferred type and folder
   - The **description** from the planned link (if available) — this is the primary content guidance
   - The referencing notes and their content context (so the target Claude understands what's needed)
   - Instruction to use vault-write for each note
4. **No session found:** Report to the user:
   > "No active session for project {name}. Start a Claude session in {project-path} and ask it to write these notes, or run vault-stub from there."

   Do **not** create empty stubs. An unresolved wikilink is better than an empty note.

### Never do this

- Write files with TODO markers or "stub, needs content" placeholders
- Create 0-byte files to "resolve" graph nodes
- Write generic placeholder content without codebase context
- Create notes for projects whose codebase you haven't read

## Phase 4 — Report

```
Resolved {N} broken wikilinks:

  Current project ({project}):
    knowledge/session-lock-deep-dive.md — written with content

  Dispatched to other sessions:
    osrps (agent {id}): 3 notes handed off
    bloxus: no active session — 2 notes deferred

  Remaining unresolved: {N} (no project session available)
```

## Quality Rules

- Every note written must have real content — no TODO markers, no placeholder text
- Notes pass the same frontmatter validation as vault-write (required fields, valid enums)
- Never overwrite an existing note — skip if a file exists at the target path
- An unresolved wikilink is always preferable to an empty or shallow note
