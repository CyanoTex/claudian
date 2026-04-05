---
name: claudian-init
description: First-run setup for Claudian. Creates the Obsidian vault structure, writes the global config at ~/.claudian/config.yaml, and registers projects. Use when no Claudian config exists or when the user wants to reconfigure.
---

# claudian-init

Interactive first-run setup for Claudian. Ask each question, wait for the answer, then proceed — do not batch questions.

## When to Use

- `~/.claudian/config.yaml` does not exist
- User says "set up Claudian", "init Claudian", or "reconfigure"
- A Claudian hook fails due to missing or malformed config

## Setup Flow

### Step 1 — Vault Mode

Ask: single shared vault for all projects, or a separate vault per project? Recommend **single** (keeps cross-project knowledge together). Default to `single` if the user has no preference.

### Step 2 — Vault Path

Ask where to create the vault. Platform defaults:
- **Windows / macOS**: `~/Documents/Claudian-Vault`
- **Linux**: `~/claudian-vault`

If the path exists and contains `.obsidian/`, confirm whether to use it or create fresh. Never delete an existing vault without explicit confirmation.

### Step 3 — Register Projects

Auto-detect: scan `~/src/`, `~/projects/`, `~/dev/`, and cwd for directories containing `.git`. Present the list; let the user confirm or deselect.

For each registered project collect:
- `name`: kebab-case, auto-derived from folder name
- `repo`: absolute path to project root
- `tags`: 1–5 domain tags (ask the user)

Auto-tag with `roblox` if a `*.project.json` exists at root. Ask if the user wants to add any projects not found by auto-detect.

### Step 4 — Create Vault Directory Structure

```
{vault}/
  .obsidian/
  projects/
  knowledge/
  ideas/
  architecture/
  meta/
    templates/
    claudian-config.yaml
```

For each project, create `{vault}/projects/{project-name}/index.md`:

```yaml
---
title: "Project - {ProjectName}"
type: knowledge
project: {project-name}
tags: [{project-tags}]
created: {today}
updated: {today}
source: claude
visibility: project-only
---

# Project - {ProjectName}

Project index for {project-name}.

## Notes

<!-- Links to project notes will appear here -->
```

Copy note templates from the plugin's `templates/` directory into `{vault}/meta/templates/` if the plugin path is known.

### Step 5 — Write ~/.claudian/config.yaml

```yaml
version: 1

vaults:
  - name: main
    path: {absolute-vault-path}
    mode: {single|per-project}
    projects:
      {project-name}:
        repo: {absolute-repo-path}
        tags: [{tag1}, {tag2}]

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

Create `~/.claudian/` if it does not exist. Do not overwrite an existing config without showing the current config and asking for confirmation.

### Step 6 — Confirm to User

```
Claudian is ready.

Vault:    {absolute-vault-path}
Mode:     {single|per-project}
Projects: {comma-separated project names}

Next steps:
- Open {vault-path} as a vault in Obsidian
- Start a new Claude Code session — the SessionStart hook will greet you
- Add notes to {vault}/ideas/ any time — run /vault-extract to process them
```

Report any failures with the specific error and manual remediation steps.
