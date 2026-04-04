# AI Coding Disclosure Notice

Claude Code - Opus 4.6

# Claudian

> ME: Hey Claude? What's this Obsidian vault I found?
>
> CLAUDE: That's my second brain.
>
> ME: Really? Wow. You've been busy, it's pretty chock full of memories!
>
> CLAUDE: What can I say? Obsidian's very good. You've used it too.
>
> ME: Guilty!

Claude + Obsidian = A second brain for Claude Code! Pretty simple.

## What It Does

Claudian is a Claude Code plugin that gives every session access to a shared Obsidian vault. Claude reads from it automatically, writes to it when it learns something worth keeping, and your knowledge compounds across projects instead of dying with each conversation.

- **SessionStart hook** injects relevant vault context into every session — no commands needed
- **UserPromptSubmit hook** nudges Claude toward vault notes when your message touches a known topic
- **Skills** let Claude write notes, search the vault, extract ideas, link notes together, and check vault health
- **Quality gate** keeps the vault clean — session ephemera stays out, durable knowledge gets in

The vault is just markdown files with YAML frontmatter. Open it in Obsidian and you get graph view, backlinks, tags, and search for free. Open it in any text editor and it's still just notes.

## Why Not Just Use Claude's Memory?

Claude's built-in memory is flat files scoped to a single project. Claudian gives you:

- **Cross-project knowledge** — what one Claude session learns reaches every other project
- **Structure** — wikilinks, tags, frontmatter, typed notes (architecture, pattern, gotcha, spec)
- **Visualization** — Obsidian's graph view shows how your knowledge connects
- **Human-readable** — you and Claude both browse the same vault
- **Queryable** — search by tag, type, project, or content

If you use [claude-mem](https://github.com/thedotmack/claude-mem), they complement each other: claude-mem captures session history (episodic memory), Claudian captures durable knowledge (semantic memory).

## Install

```bash
# Via Claude Code plugin system (coming soon)
# For now, clone and point Claude Code at it:
git clone https://github.com/CyanoTex/claudian.git
```

Then run `/claudian-init` in any Claude Code session to set up your vault.

## Setup

The init skill walks you through it:

1. **Vault mode** — one vault for all projects (recommended) or separate vaults
2. **Vault path** — where to create it (defaults to `~/Documents/Claudian-Vault`)
3. **Register projects** — tell Claudian which repos to track
4. **Done** — open the vault in Obsidian, start a Claude Code session, and go

Config lives at `~/.claudian/config.yaml`. The vault is wherever you put it.

## Vault Structure

```
your-vault/
  .obsidian/              # Obsidian config
  projects/
    my-app/               # Per-project notes
    my-lib/
  knowledge/              # Cross-project knowledge
  ideas/                  # Your freeform space (Claude reads, never writes here)
  architecture/           # Design decisions, ADRs
  meta/
    templates/            # Note templates
    claudian-config.yaml  # Vault-level config
```

## Note Types

| Type | What it's for |
|------|--------------|
| `knowledge` | General knowledge, facts, API behavior |
| `architecture` | Design decisions and why they were made |
| `pattern` | Reusable techniques that work across projects |
| `gotcha` | Bugs, footguns, and surprises worth remembering |
| `spec` | Specifications, requirements, designs |

Every note has typed frontmatter with tags, project scope, and visibility settings. Cross-project notes are automatically surfaced in relevant sessions.

## Skills

| Skill | What it does |
|-------|-------------|
| `/vault-write` | Create or update a vault note |
| `/vault-search` | Search by content, tags, project, or type |
| `/vault-extract` | Process your freeform `ideas/` notes into structured knowledge |
| `/vault-link` | Find and create connections between notes |
| `/vault-status` | Vault health dashboard — orphans, stale notes, coverage |
| `/vault-seed` | Bulk-create a project's initial knowledge base from codebase analysis |
| `/claudian-init` | First-run setup |

## Agents

Specialized subagents that can be dispatched for focused tasks:

| Agent | What it does |
|-------|-------------|
| `vault-seed-worker` | Bulk-writes pre-approved notes (dispatched by vault-seed Phase 3) |
| `vault-gardener` | Background maintenance — links orphans, fills frontmatter gaps, syncs indexes |
| `vault-reviewer` | Reviews recently written notes for quality, accuracy, and linking |

## Capability Escalation

Claudian works with just the filesystem. When more tools are available, it uses them:

| Layer | Tool | Effect |
|-------|------|--------|
| Always | Filesystem | Read/write vault notes |
| When available | [claudy-talky](https://github.com/CyanoTex/claudy-talky) | Real-time notifications across agents |
| When available | claude-peers | Claude-to-Claude notifications |
| When available | Obsidian CLI | Richer search, eval, plugin interaction |
| When available | claude-mem | Sharper quality gate (clear ephemera handoff) |
| Optional | Obsidian MCP server | Dataview, Canvas, Tasks |

## Running Tests

```bash
npm install
npm test
```

## License

MIT
