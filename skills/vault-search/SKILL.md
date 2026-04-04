---
name: vault-search
description: Search the Claudian Obsidian vault by content, tags, project, or note type. Use when you need context from the vault, when the SessionStart hook surfaced relevant notes, or when the UserPromptSubmit hook nudged you toward vault content.
---

# vault-search

Search the Claudian Obsidian vault to retrieve relevant notes and context.

## When to Use

- The SessionStart hook listed notes that may be relevant to this session
- The UserPromptSubmit hook flagged vault content related to the user's request
- You need prior context before writing new code or making a decision
- The user asks about something you might have notes on
- You are about to use vault-write and want to check for duplicates

## How to Search

### By Tags

Tags are stored in frontmatter. Search for notes with a specific tag:

```bash
grep -rl "tags:.*<tagname>" {vault}/
```

Or for a tag in a YAML list:

```bash
grep -rl "\- <tagname>" {vault}/
```

### By Project

All notes for a project live in `{vault}/projects/{project-name}/`. Read the folder to get an overview, then read individual notes:

```bash
ls {vault}/projects/{project-name}/
```

The project index note (`{vault}/projects/{project-name}/index.md`) provides a summary and links to all project notes.

### By Content

Full-text search across the vault:

```bash
grep -rl "<search-term>" {vault}/
```

For more context around matches:

```bash
grep -r -C 3 "<search-term>" {vault}/
```

### By Note Type

Filter by the `type` frontmatter field:

```bash
grep -rl "^type: <architecture|pattern|gotcha|insight|reference>" {vault}/
```

## Structured Query Syntax

When a user or hook asks you to search, interpret queries in this format:

```
tag:<tagname> project:<project-name> type:<note-type> "<freetext>"
```

Examples:
- `tag:datastore project:bloxus` — DataStore notes in the Bloxus project
- `type:gotcha "require ordering"` — gotcha notes containing "require ordering"
- `project:cross-project tag:networking` — cross-project networking notes

Decompose the query into its components and run the appropriate grep commands.

## Presenting Results

After searching, present results as a summary table:

| Title | Type | Tags | Path |
|-------|------|------|------|
| DataStore Session Lock | pattern | datastore, sessions | projects/bloxus/datastore-session-lock.md |
| Module Require Gotcha | gotcha | modules, require | knowledge/module-require-gotcha.md |

Then ask the user which notes to open in full, or read the most relevant ones immediately if the context makes the right choice obvious.

## When Obsidian CLI is Available

If the `obsidian` CLI is on PATH, prefer it for richer query support:

```bash
obsidian search query="<your query>" format=json
```

Parse the JSON response to extract titles, paths, and snippets, then present them in the summary table format above.

## Reading a Note

Once you identify a relevant note, read it with the Read tool using the absolute path. Always read the full note — do not truncate or summarize frontmatter.
