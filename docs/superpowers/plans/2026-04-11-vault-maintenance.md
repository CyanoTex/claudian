# Vault Maintenance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add links-to validation, vault-seed checkpoint/resume, and automatic agent triggers.

**Architecture:** Three independent features sharing one file (session-start.runner.js). #4 adds a pure validation function to frontmatter.js and integrates it into quality-gate.js. #6 adds manifest instructions to the vault-seed skill and detection to SessionStart. #9 adds reviewer dispatch to vault-write skill and gardener staleness check to SessionStart.

**Tech Stack:** Node.js (ESM, builtins only), Vitest, Markdown skills/agents

---

## File Structure

| File | Role | Changed by |
|------|------|-----------|
| `core/frontmatter.js` | New `validateLinksTo()` function | #4 |
| `core/quality-gate.js` | Call validateLinksTo, add warnings to return | #4 |
| `tests/frontmatter.test.js` | Tests for validateLinksTo | #4 |
| `tests/quality-gate.test.js` | Tests for links-to warnings in evaluate | #4 |
| `skills/vault-seed/SKILL.md` | Manifest read/write instructions | #6 |
| `skills/vault-write/SKILL.md` | Add reviewer dispatch step | #9 |
| `agents/vault-gardener.md` | Add timestamp write instruction | #9 |
| `hooks/session-start.runner.js` | Manifest detection (#6) + gardener nudge (#9) | #6, #9 |
| `tests/hooks/session-start.test.js` | Tests for manifest + gardener nudge | #6, #9 |
| `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Version bump | all |

---

### Task 1: validateLinksTo function and tests

**Files:**
- Modify: `core/frontmatter.js`
- Modify: `tests/frontmatter.test.js`

- [ ] **Step 1: Write failing tests for validateLinksTo**

Add to `tests/frontmatter.test.js` after the `validate` describe block (before the closing `});`):

```javascript
  describe('validateLinksTo', () => {
    const index = [
      { title: 'Existing Note', path: 'knowledge/existing.md' },
      { title: 'Another Note', path: 'knowledge/another.md' },
    ];

    it('returns all valid when links-to titles exist in index', () => {
      const result = validateLinksTo(['Existing Note', 'Another Note'], index);
      expect(result.valid).toEqual(['Existing Note', 'Another Note']);
      expect(result.dangling).toEqual([]);
    });

    it('flags titles not in index or planned links as dangling', () => {
      const result = validateLinksTo(['Existing Note', 'Ghost Note'], index);
      expect(result.valid).toEqual(['Existing Note']);
      expect(result.dangling).toEqual(['Ghost Note']);
    });

    it('accepts planned links as valid', () => {
      const planned = ['Future Note'];
      const result = validateLinksTo(['Future Note'], index, planned);
      expect(result.valid).toEqual(['Future Note']);
      expect(result.dangling).toEqual([]);
    });

    it('uses case-insensitive matching', () => {
      const result = validateLinksTo(['existing note', 'ANOTHER NOTE'], index);
      expect(result.valid).toEqual(['existing note', 'ANOTHER NOTE']);
      expect(result.dangling).toEqual([]);
    });

    it('returns empty arrays for empty links-to', () => {
      const result = validateLinksTo([], index);
      expect(result.valid).toEqual([]);
      expect(result.dangling).toEqual([]);
    });

    it('returns empty arrays for null/undefined links-to', () => {
      expect(validateLinksTo(null, index)).toEqual({ valid: [], dangling: [] });
      expect(validateLinksTo(undefined, index)).toEqual({ valid: [], dangling: [] });
    });
  });
```

Also update the import line at the top of the file:

```javascript
import { parse, generate, validate, validateLinksTo, normalizeTags, VALID_TYPES, VALID_SOURCES } from '../core/frontmatter.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/frontmatter.test.js`

Expected: FAIL — `validateLinksTo` is not exported.

- [ ] **Step 3: Implement validateLinksTo**

Add to `core/frontmatter.js` after the `validate` function:

```javascript
export function validateLinksTo(linksTo, index, plannedLinks = []) {
  if (!Array.isArray(linksTo) || linksTo.length === 0) {
    return { valid: [], dangling: [] };
  }

  const existingTitles = new Set(index.map(n => n.title.toLowerCase()));
  const plannedTitles = new Set(plannedLinks.map(t => t.toLowerCase()));

  const valid = [];
  const dangling = [];

  for (const title of linksTo) {
    const lower = title.toLowerCase();
    if (existingTitles.has(lower) || plannedTitles.has(lower)) {
      valid.push(title);
    } else {
      dangling.push(title);
    }
  }

  return { valid, dangling };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/frontmatter.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/frontmatter.js tests/frontmatter.test.js
git commit -m "feat: add validateLinksTo for links-to frontmatter validation

Validates links-to entries against existing vault notes and planned
links. Case-insensitive matching. Returns { valid, dangling } arrays.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Quality gate links-to integration and tests

**Files:**
- Modify: `core/quality-gate.js`
- Modify: `tests/quality-gate.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/quality-gate.test.js` after the `durable knowledge check` describe block:

```javascript
  describe('links-to validation', () => {
    const existingIndex = [
      { title: 'DataStore Session Locking', path: '/vault/knowledge/datastore-locking.md', tags: ['datastore'], project: 'my-project' },
      { title: 'Error Handling Pattern', path: '/vault/knowledge/errors.md', tags: ['errors'], project: 'cross-project' },
    ];

    it('adds warnings for dangling links-to entries', () => {
      const note = { ...validNote, 'links-to': ['DataStore Session Locking', 'Ghost Note'] };
      const result = evaluate(note, existingIndex);
      expect(result.action).toBe(WRITE);
      expect(result.warnings).toContain('links-to references "Ghost Note" which does not exist');
    });

    it('returns no warnings when all links-to entries are valid', () => {
      const note = { ...validNote, 'links-to': ['DataStore Session Locking'] };
      const result = evaluate(note, existingIndex);
      expect(result.action).toBe(WRITE);
      expect(result.warnings).toEqual([]);
    });

    it('returns no warnings when links-to is empty', () => {
      const note = { ...validNote, 'links-to': [] };
      const result = evaluate(note, existingIndex);
      expect(result.warnings).toEqual([]);
    });

    it('returns no warnings when links-to is missing', () => {
      const result = evaluate(validNote, existingIndex);
      expect(result.warnings).toEqual([]);
    });

    it('accepts planned links as valid', () => {
      const note = { ...validNote, 'links-to': ['Future Note'] };
      const result = evaluate(note, existingIndex, { plannedLinks: ['Future Note'] });
      expect(result.warnings).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/quality-gate.test.js`

Expected: FAIL — `warnings` is undefined on the result.

- [ ] **Step 3: Implement quality gate integration**

In `core/quality-gate.js`, add the import at the top:

```javascript
import { validateLinksTo } from './frontmatter.js';
```

Replace the `evaluate` function:

```javascript
export function evaluate(note, existingIndex, { plannedLinks = [] } = {}) {
  const validationError = validateBasics(note);
  if (validationError) return { action: REJECT, reason: validationError, warnings: [] };

  if (isEphemera(note)) {
    return { action: REJECT, reason: 'Content appears to be session ephemera, not durable knowledge.', warnings: [] };
  }

  const duplicate = findDuplicate(note, existingIndex);
  if (duplicate) {
    return { action: UPDATE, reason: `Similar note exists: "${duplicate.title}"`, existingPath: duplicate.path, warnings: [] };
  }

  const warnings = [];
  const { dangling } = validateLinksTo(note['links-to'], existingIndex, plannedLinks);
  for (const title of dangling) {
    warnings.push(`links-to references "${title}" which does not exist`);
  }

  return { action: WRITE, reason: 'Passes quality gate.', warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/quality-gate.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: All tests PASS — the `warnings` field addition is backwards-compatible.

- [ ] **Step 6: Commit**

```bash
git add core/quality-gate.js tests/quality-gate.test.js
git commit -m "feat: integrate links-to validation into quality gate

Quality gate now validates links-to entries against vault index and
planned links. Dangling references produce warnings (not rejections).
Backwards-compatible: adds warnings array to all return values.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: vault-seed manifest instructions

**Files:**
- Modify: `skills/vault-seed/SKILL.md`

This is a skill file (markdown) edit — no tests needed.

- [ ] **Step 1: Add manifest instructions to Phase 3**

In `skills/vault-seed/SKILL.md`, insert a new step BEFORE `### Step 1: Write the project index first`:

```markdown
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
```

At the end of `### Step 1: Write the project index first`, add:

```markdown
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
```

In `### Step 2: Offer each note individually`, add after the three response options:

```markdown
After each user decision, update the manifest:
- "Yes" + note created → set status to `created`, set path to the written file path
- "Not now" → set status to `deferred`
- "Skip all" → set remaining `pending` notes to `skipped`

When all notes are `created` or `skipped` (no `pending` or `deferred`), delete the manifest.
```

- [ ] **Step 2: Commit**

```bash
git add skills/vault-seed/SKILL.md
git commit -m "feat: add checkpoint/resume manifest to vault-seed skill

Agents now write a seed-manifest.json tracking per-note status
(pending/created/deferred/skipped). Subsequent runs detect the
manifest and offer to resume. Manifest is cleaned up when complete.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: vault-write reviewer dispatch and gardener timestamp

**Files:**
- Modify: `skills/vault-write/SKILL.md`
- Modify: `agents/vault-gardener.md`

Both are markdown files — no tests needed.

- [ ] **Step 1: Add reviewer dispatch to vault-write**

In `skills/vault-write/SKILL.md`, add a new step after step 5 (Place in the correct folder), before the `## File Naming` section:

```markdown
**6. Dispatch reviewer** — after writing the note, dispatch the `vault-reviewer` agent in the background to review it. Do not wait for the result. Use the Agent tool with `run_in_background: true` and pass the path of the note you just wrote. The reviewer will surface any issues as a background notification.
```

- [ ] **Step 2: Add timestamp instruction to vault-gardener**

In `agents/vault-gardener.md`, add a new section before `## Rules`:

```markdown
## On Completion

After all checks and fixes are done, write the current date to `{vault}/.claudian/gardener-last-run`:

```
YYYY-MM-DD
```

Create the `.claudian/` directory if it doesn't exist. This timestamp is checked by SessionStart to determine when maintenance last ran.
```

- [ ] **Step 3: Commit**

```bash
git add skills/vault-write/SKILL.md agents/vault-gardener.md
git commit -m "feat: add auto-review trigger and gardener timestamp

vault-write now dispatches vault-reviewer in background after writing.
vault-gardener writes a last-run timestamp for SessionStart staleness check.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: SessionStart manifest detection and gardener nudge

**Files:**
- Modify: `hooks/session-start.runner.js`
- Modify: `tests/hooks/session-start.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/hooks/session-start.test.js` after the `writes session-scoped pointer files` test, inside the main describe:

```javascript
  it('nudges when seed manifest has unfinished notes', async () => {
    const projectDir = join(vaultDir, 'projects', 'test-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'index.md'), `---
title: "Project - test-project"
type: knowledge
project: test-project
tags: [test]
created: "2026-04-04"
updated: "2026-04-04"
source: claude
---

# Project - test-project
`);

    const manifest = {
      created: '2026-04-11',
      project: 'test-project',
      notes: [
        { title: 'Done Note', status: 'created', path: 'knowledge/done.md' },
        { title: 'Pending Note', status: 'pending', path: null },
        { title: 'Deferred Note', status: 'deferred', path: null },
      ],
    };
    await writeFile(join(projectDir, 'seed-manifest.json'), JSON.stringify(manifest));

    await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ${vaultDir.replace(/\\/g, '/')}
    mode: single
    projects:
      test-project:
        repos:
          - ${process.cwd().replace(/\\/g, '/')}
capabilities:
  obsidian-cli: auto-detect
`);

    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('vault-seed has 2 unfinished note');
  });

  it('nudges when gardener has never run', async () => {
    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('Vault maintenance has never run');
  });

  it('nudges when gardener last ran more than 7 days ago', async () => {
    const claudianDir = join(vaultDir, '.claudian');
    await mkdir(claudianDir, { recursive: true });
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await writeFile(join(claudianDir, 'gardener-last-run'), oldDate);

    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("hasn't run in");
  });

  it('does not nudge when gardener ran recently', async () => {
    const claudianDir = join(vaultDir, '.claudian');
    await mkdir(claudianDir, { recursive: true });
    const today = new Date().toISOString().split('T')[0];
    await writeFile(join(claudianDir, 'gardener-last-run'), today);

    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).not.toContain('maintenance');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/hooks/session-start.test.js`

Expected: FAIL — no manifest or gardener nudge logic exists.

- [ ] **Step 3: Implement SessionStart additions**

In `hooks/session-start.runner.js`, add the manifest detection and gardener nudge blocks. Insert after the planned links block (after the `try/catch` for project index around line 96), before the warnings block:

```javascript
  // Seed manifest detection
  if (project) {
    try {
      const manifestPath = join(vaultPath, 'projects', project, 'seed-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      const unfinished = (manifest.notes || []).filter(n => n.status === 'pending' || n.status === 'deferred');
      if (unfinished.length > 0) {
        lines.push(`## Seed Progress`);
        lines.push(``);
        lines.push(`vault-seed has ${unfinished.length} unfinished note(s) for ${project}. Run /vault-seed to resume.`);
        lines.push(``);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        warnings.push({ file: `projects/${project}/seed-manifest.json`, error: err.message });
      }
    }
  }

  // Gardener staleness check
  try {
    const gardenerTimePath = join(vaultPath, '.claudian', 'gardener-last-run');
    const lastRun = (await readFile(gardenerTimePath, 'utf-8')).trim();
    const daysAgo = Math.floor((Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo >= 7) {
      lines.push(`## Maintenance`);
      lines.push(``);
      lines.push(`Vault maintenance hasn't run in ${daysAgo} days. Consider running /vault-gardener.`);
      lines.push(``);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      lines.push(`## Maintenance`);
      lines.push(``);
      lines.push(`Vault maintenance has never run. Consider running /vault-gardener.`);
      lines.push(``);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/hooks/session-start.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add hooks/session-start.runner.js tests/hooks/session-start.test.js
git commit -m "feat: add seed manifest detection and gardener nudge to SessionStart

SessionStart now:
- Detects seed-manifest.json and nudges about unfinished notes (#6)
- Checks gardener-last-run timestamp and nudges if stale or missing (#9)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Version bump

**Files:**
- Modify: `package.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Bump version in all three files**

Bump from 0.1.11 to 0.1.12 in:
- `package.json` → `"version"` field
- `.claude-plugin/plugin.json` → `"version"` field
- `.claude-plugin/marketplace.json` → `"version"` field in `metadata`

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 0.1.12 for vault maintenance improvements

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
