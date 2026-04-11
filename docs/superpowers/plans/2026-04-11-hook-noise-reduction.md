# Hook Noise Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce UserPromptSubmit hook noise by replacing boolean keyword matching with scored relevance matching and a minimum threshold.

**Architecture:** Replace `matchKeywords()` with `scoreMatch()` that returns a numeric score per note. Add a short-message bypass (< 20 chars). Filter by minimum score of 4, sort by score, cap at 3 results. All changes in the hook runner and its test file.

**Tech Stack:** Node.js (ESM, builtins only), Vitest

---

## File Structure

| File | Role |
|------|------|
| `hooks/user-prompt-submit.runner.js` | Hook entry point — scored matching, short message bypass, output formatting |
| `tests/hooks/user-prompt-submit.test.js` | Test suite for new scoring behavior |

No new files. No new dependencies.

---

### Task 1: Write failing tests for `scoreMatch`

**Files:**
- Modify: `tests/hooks/user-prompt-submit.test.js`

- [ ] **Step 1: Replace the existing `matchKeywords` test block with `scoreMatch` tests**

Replace the entire file content with:

```javascript
import { describe, it, expect } from 'vitest';
import { scoreMatch } from '../../hooks/user-prompt-submit.runner.js';
import { isRelevant } from '../../core/relevance.js';

describe('user-prompt-submit', () => {
  describe('scoreMatch', () => {
    it('scores 2 points per title word match (5+ chars, whole-word)', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['concurrency'],
        relPath: 'knowledge/datastore.md',
      };
      // "datastore" (9 chars) matches, "locking" (7 chars) matches = 4 pts
      // Tag "concurrency" does NOT appear in message, so no tag score
      const score = scoreMatch('How does datastore locking work?', note);
      expect(score).toBe(4);
    });

    it('ignores title words under 5 characters', () => {
      const note = {
        title: 'App Architecture',
        tags: ['architecture'],
        relPath: 'projects/my-game/arch.md',
      };
      // "App" is 3 chars — ignored. Only "architecture" (12 chars) matches = 2 pts
      const score = scoreMatch('Explain the app architecture', note);
      expect(score).toBe(5); // 2 (title "architecture") + 3 (tag "architecture")
    });

    it('scores 3 points per tag match', () => {
      const note = {
        title: 'Error Handling Pattern',
        tags: ['errors', 'patterns'],
        relPath: 'knowledge/errors.md',
      };
      // Tag "errors" (6 chars) matches = 3 pts
      const score = scoreMatch('We keep seeing errors in production', note);
      expect(score).toBe(3);
    });

    it('returns 0 for no matches', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['datastore', 'concurrency'],
        relPath: 'knowledge/datastore.md',
      };
      const score = scoreMatch('What is the weather today?', note);
      expect(score).toBe(0);
    });

    it('uses whole-word matching, not substring', () => {
      const note = {
        title: 'Session Management',
        tags: ['session'],
        relPath: 'knowledge/session.md',
      };
      // "obsession" contains "session" as substring but is a different word
      const score = scoreMatch('My obsession with clean code', note);
      expect(score).toBe(0);
    });

    it('handles hyphenated words in titles', () => {
      const note = {
        title: 'Cross-Platform Path Handling',
        tags: ['paths'],
        relPath: 'knowledge/cross-platform.md',
      };
      // "cross" is 5 chars, "platform" is 8 chars — both match
      const score = scoreMatch('We need cross platform support', note);
      expect(score).toBe(4);
    });

    it('combines title and tag scores', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['datastore', 'concurrency'],
        relPath: 'knowledge/datastore.md',
      };
      // "datastore" title match (2) + "datastore" tag match (3) + "concurrency" tag match (3) = 8
      const score = scoreMatch('datastore concurrency issues', note);
      expect(score).toBe(8);
    });

    it('is case-insensitive', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['datastore'],
        relPath: 'knowledge/datastore.md',
      };
      const score = scoreMatch('DATASTORE problems', note);
      expect(score).toBeGreaterThan(0);
    });

    it('matches hyphenated tags when message contains the hyphenated form', () => {
      const note = {
        title: 'Seed Worker Agent',
        tags: ['vault-seed', 'claude-code'],
        relPath: 'knowledge/seed-worker.md',
      };
      // "vault-seed" preserved as token, matches tag
      const score = scoreMatch('the vault-seed process is broken', note);
      expect(score).toBe(3); // 1 tag match
    });

    it('matches hyphenated title words from non-hyphenated message', () => {
      const note = {
        title: 'Cross-Platform Path Handling',
        tags: ['paths'],
        relPath: 'knowledge/cross-platform.md',
      };
      // Title splits "Cross-Platform" into "cross" + "platform"
      // Message has "cross" and "platform" as separate words
      const score = scoreMatch('We need cross platform path handling', note);
      expect(score).toBe(6); // cross(2) + platform(2) + handling(2)
    });
  });

  describe('visibility filtering', () => {
    const mixedIndex = [
      { title: 'DataStore Locking', tags: ['datastore'], relPath: 'knowledge/datastore.md', project: 'my-game', visibility: 'project-only', 'relevant-to': [] },
      { title: 'Shared Pattern', tags: ['datastore'], relPath: 'knowledge/shared.md', project: 'cross-project', visibility: 'cross-project', 'relevant-to': [] },
      { title: 'Other Game DataStore', tags: ['datastore'], relPath: 'projects/other-game/ds.md', project: 'other-game', visibility: 'project-only', 'relevant-to': [] },
      { title: 'Linked DataStore Note', tags: ['datastore'], relPath: 'knowledge/linked.md', project: 'other-game', visibility: 'project-only', 'relevant-to': ['my-game'] },
    ];

    it('filters out project-only notes from other projects', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, 'my-game'));
      const titles = filtered.map(n => n.title);
      expect(titles).toContain('DataStore Locking');
      expect(titles).toContain('Shared Pattern');
      expect(titles).toContain('Linked DataStore Note');
      expect(titles).not.toContain('Other Game DataStore');
    });

    it('allows cross-project notes through for any project', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, 'unrelated-project'));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Shared Pattern');
    });

    it('excludes all project-only notes when project is null', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, null));
      expect(filtered.every(n => n.visibility === 'cross-project' || n.project === 'cross-project')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/hooks/user-prompt-submit.test.js`

Expected: FAIL — `scoreMatch` is not exported from the runner (it doesn't exist yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/hooks/user-prompt-submit.test.js
git commit -m "test: add scoreMatch tests for hook noise reduction"
```

---

### Task 2: Implement `scoreMatch` and short message bypass

**Files:**
- Modify: `hooks/user-prompt-submit.runner.js`

- [ ] **Step 1: Replace `matchKeywords` with `scoreMatch` and update `run()`**

Replace the entire file content with:

```javascript
import { readFile } from 'fs/promises';
import { cachePointerPath } from '../core/resolver.js';

const MIN_MESSAGE_LENGTH = 20;
const MIN_SCORE = 4;
const MAX_SUGGESTIONS = 3;

function isRelevant(note, currentProject) {
  if (note.project === currentProject) return true;
  if (note.project === 'cross-project' || note.visibility === 'cross-project') return true;
  if (note['relevant-to'] && note['relevant-to'].includes(currentProject)) return true;
  return false;
}

function tokenize(text) {
  const raw = text.toLowerCase().split(/[\s.,;:!?()\[\]"']+/).filter(w => w.length > 0);
  const tokens = new Set();
  for (const token of raw) {
    tokens.add(token);
    if (token.includes('-') || token.includes('_')) {
      for (const part of token.split(/[-_]+/)) {
        if (part.length > 0) tokens.add(part);
      }
    }
  }
  return tokens;
}

export function scoreMatch(message, note) {
  const messageWords = tokenize(message);
  let score = 0;

  const titleWords = note.title.split(/[\s\-_]+/).map(w => w.toLowerCase()).filter(w => w.length >= 5);
  for (const word of titleWords) {
    if (messageWords.has(word)) score += 2;
  }

  for (const tag of note.tags) {
    if (messageWords.has(tag.toLowerCase())) score += 3;
  }

  return score;
}

async function run() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    emptyOutput();
    return;
  }

  let userMessage;
  try {
    const parsed = JSON.parse(input);
    userMessage = parsed.message || parsed.prompt || input;
  } catch {
    userMessage = input;
  }

  if (userMessage.length < MIN_MESSAGE_LENGTH) {
    emptyOutput();
    return;
  }

  const pointerPath = cachePointerPath();
  let index;
  try {
    const cachePath = (await readFile(pointerPath, 'utf-8')).trim();
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    const project = cached.project || null;
    const fullIndex = 'index' in cached ? cached.index : cached;
    index = fullIndex.filter(note => isRelevant(note, project));
  } catch {
    emptyOutput();
    return;
  }

  const scored = index
    .map(note => ({ note, score: scoreMatch(userMessage, note) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);

  if (scored.length === 0) {
    emptyOutput();
    return;
  }

  const noteList = scored.map(({ note }) => `[[${note.title}]] (${note.relPath})`).join(', ');
  const context = `[Claudian] Vault may have relevant notes: ${noteList}. Consider vault-search.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  }));
}

function emptyOutput() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: '',
    },
  }));
}

import { pathToFileURL } from 'url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch(() => emptyOutput());
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tests/hooks/user-prompt-submit.test.js`

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add hooks/user-prompt-submit.runner.js tests/hooks/user-prompt-submit.test.js
git commit -m "feat: replace keyword matching with scored relevance in UserPromptSubmit

Addresses field feedback from OSRPS and RCCS agents. Changes:
- scoreMatch() with 2pts/title-word + 3pts/tag, whole-word matching
- Minimum 5-char words for title matching (up from 3)
- Minimum score threshold of 4 (requires 2+ matches)
- Short message bypass (< 20 chars)
- Cap reduced from 5 to 3 suggestions, sorted by score"
```

---

### Task 3: Add edge case tests

**Files:**
- Modify: `tests/hooks/user-prompt-submit.test.js`

- [ ] **Step 1: Add short message and integration-style tests**

Add the following `describe` block after the `scoreMatch` block (before `visibility filtering`):

```javascript
  describe('short message bypass', () => {
    it('scores normally for messages >= 20 chars', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['datastore'],
        relPath: 'knowledge/datastore.md',
      };
      // 31 chars — above threshold
      const score = scoreMatch('How does datastore locking work', note);
      expect(score).toBeGreaterThan(0);
    });

    it('scoreMatch still works on short messages (bypass is in run())', () => {
      const note = {
        title: 'Error Handling',
        tags: ['errors'],
        relPath: 'knowledge/errors.md',
      };
      // scoreMatch itself doesn't enforce length — that's run()'s job
      const score = scoreMatch('errors', note);
      expect(score).toBe(3); // tag match
    });
  });

  describe('threshold filtering', () => {
    it('single generic title word scores below threshold', () => {
      const note = {
        title: 'Dangling Wikilink Anti-Pattern',
        tags: ['obsidian', 'wikilinks', 'vault-seed'],
        relPath: 'architecture/dangling-wikilink-anti-pattern.md',
      };
      // Only "pattern" matches (2 pts) — below threshold of 4
      const score = scoreMatch('check the pattern for this feature', note);
      expect(score).toBeLessThan(4);
    });

    it('two specific words meet threshold', () => {
      const note = {
        title: 'Dangling Wikilink Anti-Pattern',
        tags: ['obsidian', 'wikilinks', 'vault-seed'],
        relPath: 'architecture/dangling-wikilink-anti-pattern.md',
      };
      // "dangling" (2) + "wikilink" (2) = 4, meets threshold
      const score = scoreMatch('fix the dangling wikilink issue', note);
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('tag plus title word exceeds threshold', () => {
      const note = {
        title: 'Plugin Cache Versioning Gotcha',
        tags: ['plugin', 'cache', 'versioning'],
        relPath: 'knowledge/plugin-cache-versioning-gotcha.md',
      };
      // "plugin" title (2) + "plugin" tag (3) + "cache" tag (3) = 8
      const score = scoreMatch('the plugin cache is stale', note);
      expect(score).toBeGreaterThanOrEqual(4);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tests/hooks/user-prompt-submit.test.js`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/hooks/user-prompt-submit.test.js
git commit -m "test: add edge case and threshold tests for scored matching"
```

---

### Task 4: Version bump

**Files:**
- Modify: `package.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

All three files must be bumped together (CI enforces this).

- [ ] **Step 1: Bump patch version in all three files**

Bump from current version to next patch version in:
- `package.json` → `"version"` field
- `.claude-plugin/plugin.json` → `"version"` field
- `.claude-plugin/marketplace.json` → `"version"` field

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 0.1.X for hook noise reduction"
```
