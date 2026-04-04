---
name: claudian-init
description: First-run setup for Claudian. Creates the Obsidian vault structure, writes the global config at ~/.claudian/config.yaml, and registers projects. Use when no Claudian config exists or when the user wants to reconfigure.
---

# claudian-init

Interactive first-run setup for Claudian. Guides the user through configuring the vault, registering projects, and writing the global config.

## When to Use

- No `~/.claudian/config.yaml` exists
- The user says "set up Claudian", "init Claudian", or "reconfigure"
- A Claudian hook fails because the config is missing or malformed

## Setup Flow

Work through these steps in order. Ask each question, wait for an answer, then proceed. Do not batch all questions at once.

---

### Step 1 — Vault Mode

Ask the user which vault mode they want:

> "Do you want a single shared vault for all projects, or a separate vault per project?
> I recommend **single vault** — it keeps cross-project knowledge together and makes linking between projects easy."

Accept: `single` / `per-project`. Default to `single` if the user says they don't mind.

---

### Step 2 — Vault Path

Ask where to create (or point to) the vault:

> "Where should the vault live? Press Enter to use the default."

Platform defaults:
- **Windows**: `~/Documents/Claudian-Vault`
- **macOS**: `~/Documents/Claudian-Vault`
- **Linux**: `~/claudian-vault`

If the path already exists and contains `.obsidian/`, confirm whether to use the existing vault or create fresh. Never delete an existing vault without explicit confirmation.

---

### Step 3 — Register Projects

Ask the user to identify their projects:

> "Which projects should Claudian know about? I'll try to auto-detect from common locations."

Auto-detect: scan `~/src/`, `~/projects/`, `~/dev/`, and the current working directory for directories containing `.git`. Present the list and let the user confirm or deselect.

For each registered project, collect:
- `name`: short identifier (kebab-case, auto-derived from folder name)
- `repo`: absolute path to the project root
- `tags`: 1–5 tags describing the project domain (ask the user)

If the Bloxus plugin is detected (directory contains `default.project.json` or `*.project.json` at root), auto-tag it with `roblox`.

Ask if the user wants to add any additional projects not found by auto-detect.

---

### Step 4 — Create Vault Directory Structure

Create the following directory structure at the vault path:

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

For each registered project, create a project folder and stub index note:

```
{vault}/projects/{project-name}/
  index.md
```

The stub `index.md` should have complete frontmatter:

```yaml
---
title: "Project - {ProjectName}"
type: reference
project: {project-name}
tags: [{project-tags}]
created: {today}
updated: {today}
source: observed
visibility: project
---

# Project - {ProjectName}

Project index for {project-name}.

## Notes

<!-- Links to project notes will appear here -->
```

Copy note templates from the plugin's `templates/` directory into `{vault}/meta/templates/` if the plugin path is known.

---

### Step 5 — Write ~/.claudian/config.yaml

Write the global config file:

```yaml
version: 1

vaults:
  - id: default
    path: {absolute-vault-path}
    mode: {single|per-project}

projects:
  - name: {project-name}
    repo: {absolute-repo-path}
    vault: default
    tags:
      - {tag1}
      - {tag2}

capabilities:
  obsidianCli: auto-detect
  git: auto-detect
```

Create `~/.claudian/` if it does not exist. Do not overwrite an existing config without showing the current config and asking the user to confirm.

---

### Step 6 — Confirm to User

Report what was set up:

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

If anything failed (e.g., a directory couldn't be created), report the specific error and what the user can do manually to fix it.
