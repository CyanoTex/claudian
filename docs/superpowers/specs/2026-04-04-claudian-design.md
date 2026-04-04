# Claudian Design Spec

## Overview

Claudian is a Claude Code plugin that turns an Obsidian vault into a
persistent, structured, interlinked knowledge layer — a "second brain" that
any Claude Code session can read from and write to, regardless of which
project it's working in.

The vault holds durable knowledge: architecture docs, specs, cross-project
patterns, design decisions, gotchas, and the user's freeform ideas. It does
not hold session ephemera — that's left to tools like claude-mem.

Claudian is designed for Claude Code first, with an agent-agnostic core that
other agents (Gemini, Codex, Copilot) can integrate with via thin adapters.

## Problem

1. No good place for long-lived documentation that isn't a README.
2. No way to visualize connections between ideas, systems, and projects.
3. Claude's memory files are flat and dumb — no structure, links, or
   queryability.
4. Knowledge is siloed per project. What one Claude session learns in
   project A doesn't reach project B or C.
5. The Obsidian + Claude Code ecosystem is fragmented: 20+ MCP servers, none
   canonical, no bidirectional integration, nothing in the official plugin
   registry.

## Architecture

### Two-Layer Design

```
┌─────────────────────────────────────────┐
│         Agent Adapters (thin)           │
│  Claude Code │ Gemini │ Codex │ ...     │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│         Claudian Core (portable)        │
│  Vault spec, note templates, quality    │
│  gate rules, folder conventions,        │
│  frontmatter schema, linking rules      │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│         Obsidian Vault (markdown)       │
└─────────────────────────────────────────┘
```

The core layer is agent-agnostic: conventions, templates, and rules that any
agent can follow. The vault format IS the API. Agent adapters are thin
integration layers (hooks + skills for Claude Code, equivalents for others).

### Capability Escalation

Claudian works with just the filesystem. Additional tools are detected at
session start and used when present. No capability is required beyond
filesystem access.

```
Always:          Filesystem (vault reads/writes)
When available:  Obsidian CLI (eval, search, richer interaction)
When available:  Claudy-talky (cross-agent notifications — Claude, Codex, Gemini)
When available:  Claude-peers (Claude-to-Claude notifications)
When available:  Pitlane MCP (AST-aware code intelligence)
When available:  Context7 (external doc lookups that feed vault knowledge)
When available:  Superpowers (brainstorming/plans that produce vault artifacts)
When available:  Claude-mem (sharpens quality gate — clear handoff of ephemera)
When available:  Known plugins, e.g. Bloxus (auto-register as projects if installed)
Optional add-on: Obsidian MCP server (Dataview, Canvas, Tasks)
```

## Vault Spec

### Folder Structure

```
<vault-root>/
  .obsidian/              <- Obsidian config (themes, plugins, hotkeys)
  projects/
    <project-name>/       <- auto-created on first session in a project
  knowledge/              <- cross-project concepts, patterns, technologies
  ideas/                  <- user's freeform space — Claude reads, extracts, never writes directly
  architecture/           <- system designs, ADRs, technical decisions
  meta/
    templates/            <- note templates for each note type
    claudian-config.yaml  <- vault config (mode, project mappings, quality gate settings)
```

### Note Frontmatter Schema

Every note gets this frontmatter:

```yaml
---
title: Session Locking in DataStores
type: knowledge | architecture | idea | spec | pattern | gotcha
project: my-project           # or "cross-project"
source: claude | human | extracted
tags: [datastore, roblox, concurrency]
created: 2026-04-04
updated: 2026-04-04
visibility: project-only | cross-project
relevant-to: []             # explicit project targets for cross-project notes
links-to: []                # supplements wikilinks in body
---
```

### Wikilink Conventions

- `[[Project - MyProject]]` for project index notes
- `[[pattern-name]]` for reusable patterns
- Tags for filtering, wikilinks for relationships, folders for organization

### Ownership Rule

The `ideas/` folder belongs to the user. Claude reads it, can extract from
it (producing notes with `source: extracted`), but never writes directly
into it.

## Plugin Architecture

### Package Layout

```
claudian/
  package.json
  claudian-config.schema.json
  hooks/
    session-start.js
    user-prompt-submit.js
  skills/
    vault-write.md
    vault-search.md
    vault-extract.md
    vault-link.md
    vault-status.md
  core/
    config.js               <- load/validate config, resolve vault path
    resolver.js             <- cross-platform vault path resolution
    frontmatter.js          <- parse/generate frontmatter, enforce schema
    relevance.js            <- rank vault notes by relevance to current context
    quality-gate.js         <- filter: should this go in the vault?
  templates/
    knowledge.md
    architecture.md
    pattern.md
    gotcha.md
    spec.md
  setup/
    init.js                 <- first-run interactive setup
```

### Installation

Standard Claude Code plugin install. First run triggers `init.js`:

1. Vault mode: one vault or per-project vaults?
2. Vault path: where? (platform-appropriate defaults)
   - Windows: `~/Documents/Claudian-Vault`
   - macOS: `~/Documents/Claudian-Vault`
   - Linux: `~/claudian-vault`
3. Register projects:
   a. Auto-detect known plugins (e.g. Bloxus) and register as projects
   b. Scan common locations, user picks
   c. More can be added later via `claudian add-project`
4. Create vault structure (folders, templates, config)
5. Write global pointer: `~/.claudian/config.yaml`

### Global Config

`~/.claudian/config.yaml` — lives outside any project, tells any Claude
session where to find the vault:

```yaml
version: 1
vaults:
  - name: main
    path: ~/Documents/Claudian-Vault
    mode: single
    projects:
      example-project:
        repo: ~/src/example-project
        tags: [example, demo]

capabilities:
  obsidian-cli: auto-detect
  claude-mem: auto-detect
  claudy-talky: auto-detect
  claude-peers: auto-detect
  pitlane-mcp: auto-detect
  context7: auto-detect
  superpowers: auto-detect
  mcp-server: null
```

## Hook Behavior

### SessionStart

Fires when any Claude Code session begins.

1. Read `~/.claudian/config.yaml` to get vault path
2. Detect current project (match cwd against registered projects)
3. Detect available capabilities
4. Gather relevant notes:
   a. Project-specific notes (`projects/<current-project>/`)
   b. Cross-project knowledge matched by tag overlap
   c. Recent notes in `ideas/` (user's latest thinking)
5. Rank by relevance (recency + tag overlap + link density)
6. Inject a **table of contents** into the session — titles, paths, one-line
   descriptions, and "deep read" hints. Not full note contents. Token-light.

### UserPromptSubmit

Fires on every user message. Must be fast and cheap.

1. Keyword-match the message against the vault index loaded at session start
   (note titles, tags, project names). No AI inference, no filesystem reads.
2. If any keyword hits: append a small system note — "Vault may have relevant
   notes: [[note-1]], [[note-2]]. Consider vault-search."
3. If no hits: do nothing. Zero cost.

This is pure string matching against an in-memory index. It nudges Claude
toward the vault; it does not perform retrieval or AI-based analysis.

### No SessionEnd Hook

Writes happen during the session via skills, not as a session-end dump.
End-of-session summaries are claude-mem territory.

## Skills

### vault-write

Creates or updates a note in the vault.

**Flow:**
1. Claude invokes with content + metadata
2. Quality gate checks (see Quality Gate section)
3. Write using appropriate template
4. Auto-link: scan for wikilink targets, suggest links to related notes

### vault-search

Finds notes by content, tags, project, type, or combination.

**Flow:**
1. Accept query (natural language or structured: `tag:datastore project:my-project`)
2. Search via filesystem (grep, frontmatter parsing, glob)
3. When Obsidian CLI available: use `obsidian search` for richer results
4. Return ranked results: title, path, excerpt, relevance reason
5. Claude reads full notes via filesystem as needed

### vault-extract

Processes freeform `ideas/` notes into structured vault knowledge.

**Flow:**
1. Read the idea note
2. Identify extractable knowledge: decisions, requirements, architecture
   concepts, questions
3. Propose structured notes to create (show user what it would write)
4. On user approval: create notes with `source: extracted`
5. Flag original idea: `processed: true`, `extracted-to: [list]`

This skill asks before writing — it transforms the user's thinking, so it
requires approval.

### vault-link

Finds and strengthens connections between existing notes.

**Flow:**
1. Analyze a note's content and tags
2. Find related notes that aren't linked yet
3. Suggest wikilinks to add with reasoning
4. Optionally update both notes to cross-reference

### vault-status

Vault health dashboard.

**Output:**
- Orphan notes (no inbound links)
- Stale notes (not updated in N days, still referenced)
- Unprocessed ideas
- Tag distribution / project coverage
- Notes missing required frontmatter fields

## Quality Gate

Every vault-write passes through this filter. It asks three questions:

### 1. Is this session ephemera?

Reject if the content is:
- A session observation ("we tried X, it failed")
- A user preference ("user likes terse responses")
- A debugging step or fix attempt
- Anything scoped to a single session's timeline

When claude-mem is detected, this check sharpens: "would claude-mem capture
this?" If yes, reject. Claude-mem is a clarity enhancer for the gate, not a
dependency.

### 2. Would this be useful in a future session on a different day?

Accept if it describes:
- How a system works (architecture)
- A decision and why (ADR)
- A pattern reusable across projects
- A gotcha that would bite someone again
- A synthesis of multiple sessions into durable insight

### 3. Does this duplicate existing vault content?

- Similar note exists and new content is an update? Update the existing note.
- Different angle on the same topic? Create it, link to existing.
- Basically the same? Skip.

**Implementation:** Semantic filtering is handled by Claude's judgment via
the skill prompt. Mechanical checks (duplicate detection, frontmatter
validation) are handled by `core/quality-gate.js`.

## Cross-Session / Cross-Project Data Flow

The vault is the async communication bus between Claude sessions.

When Claude writes a note relevant beyond the current project:

```yaml
visibility: cross-project
relevant-to: [project-b, project-c]
```

SessionStart prioritizes notes with `visibility: cross-project` and
`relevant-to` matching the current project.

**Live sessions:** When multiple Claude sessions run simultaneously,
real-time notifications go through claudy-talky or claude-peers if
available. The vault handles async; messaging handles sync.

**Flow example:**

```
Project A session discovers a reusable gotcha
  -> vault-write: gotcha note, visibility: cross-project, relevant-to: [project-b]
  -> if claudy-talky/claude-peers available AND project-b agent running:
     send notification with note reference
  -> next Project B session: SessionStart surfaces the note via tag/project match
```

## Cross-Platform Support

Vault paths use platform-appropriate defaults and are always configurable.
All path handling in `core/resolver.js` uses forward slashes internally and
converts at OS boundaries. No hardcoded Windows paths in any shared code.

## Future Enhancements (Not Launch Scope)

- **Obsidian MCP server integration** — Dataview queries, Canvas, Tasks
  when an MCP server is installed
- **Agent adapters** — Gemini CLI, Codex, Copilot CLI integrations via
  Context7 research or web research
- **Obsidian CLI integration** — `obsidian eval` for rich queries, search,
  plugin interaction when Obsidian is running
- **Obsidian headless sync** — for remote server scenarios using
  `obsidian-headless` (requires Obsidian Sync subscription)
