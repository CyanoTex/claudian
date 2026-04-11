# Search & Backlinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backlinks index to buildIndex and git-context boost to SessionStart note ranking.

**Architecture:** #8 extends buildIndex() to extract outbound links from body wikilinks + links-to frontmatter, then inverts them into a backlinks map. #7 adds extractGitKeywords() in the SessionStart hook and passes keywords to rankNotes() for scoring. Both changes are additive with optional parameters for backwards compatibility.

**Tech Stack:** Node.js (ESM, builtins only), Vitest

---

## File Structure

| File | Role | Changed by |
|------|------|-----------|
| `core/relevance.js` | buildIndex backlinks (#8), scoreNote/rankNotes git keywords (#7) | #7, #8 |
| `hooks/session-start.runner.js` | extractGitKeywords (#7), cache backlinks (#8) | #7, #8 |
| `tests/relevance.test.js` | Tests for backlinks + git keyword scoring | #7, #8 |
| `tests/hooks/session-start.test.js` | Integration test for backlinks caching | #8 |
| `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Version bump | all |

---

### Task 1: Backlinks extraction in buildIndex

**Files:**
- Modify: `core/relevance.js`
- Modify: `tests/relevance.test.js`

- [ ] **Step 1: Write failing tests for backlinks**

Add to `tests/relevance.test.js` inside the `buildIndex` describe block, after the last existing test:

```javascript
    it('builds backlinks map from body wikilinks', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'note-a.md'), `---
title: Note A
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

Links to [[Note B]] and [[Note C]].`);

      await writeFile(join(vaultDir, 'knowledge', 'note-b.md'), `---
title: Note B
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

Links to [[Note A]].`);

      await writeFile(join(vaultDir, 'knowledge', 'note-c.md'), `---
title: Note C
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

No outbound links.`);

      const { backlinks } = await buildIndex(vaultDir);
      expect(backlinks['note b']).toContain('Note A');
      expect(backlinks['note c']).toContain('Note A');
      expect(backlinks['note a']).toContain('Note B');
      expect(backlinks['note c']).not.toContain('Note B');
    });

    it('captures links-to frontmatter as backlinks', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'source.md'), `---
title: Source Note
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
links-to: ["Target Note"]
---

No body wikilinks.`);

      const { backlinks } = await buildIndex(vaultDir);
      expect(backlinks['target note']).toContain('Source Note');
    });

    it('handles aliased wikilinks [[target|alias]]', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'alias-test.md'), `---
title: Alias Test
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

See [[Real Title|display text]] for details.`);

      const { backlinks } = await buildIndex(vaultDir);
      expect(backlinks['real title']).toContain('Alias Test');
      expect(backlinks['display text']).toBeUndefined();
    });

    it('returns empty backlinks for vault with no links', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'isolated.md'), `---
title: Isolated Note
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

No links here.`);

      const { backlinks } = await buildIndex(vaultDir);
      expect(Object.keys(backlinks)).toHaveLength(0);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/relevance.test.js`

Expected: FAIL -- `backlinks` is undefined (buildIndex doesn't return it yet).

- [ ] **Step 3: Implement backlinks in buildIndex**

In `core/relevance.js`, replace the entire `buildIndex` function with:

```javascript
export async function buildIndex(vaultDir) {
  const index = [];
  const warnings = [];
  const outboundLinks = new Map();

  await walkDir(vaultDir, async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const relPath = normalizePath(relative(vaultDir, filePath));
    if (relPath.startsWith('.obsidian/') || relPath.startsWith('meta/templates/')) return;

    try {
      const content = await readFile(filePath, 'utf-8');
      const { frontmatter, body } = parse(content);
      if (!frontmatter || !frontmatter.title) return;

      index.push({
        title: frontmatter.title,
        path: normalizePath(filePath),
        relPath,
        type: frontmatter.type,
        project: frontmatter.project,
        source: frontmatter.source,
        tags: normalizeTags(frontmatter.tags),
        visibility: frontmatter.visibility || 'project-only',
        'relevant-to': frontmatter['relevant-to'] || [],
        updated: frontmatter.updated || frontmatter.created,
      });

      const links = new Set();
      const bodyLinks = [...body.matchAll(/\[\[([^\]]+)\]\]/g)]
        .map(m => m[1].split('|')[0].trim());
      bodyLinks.forEach(l => links.add(l));
      const linksTo = frontmatter['links-to'] || [];
      if (Array.isArray(linksTo)) {
        linksTo.filter(l => typeof l === 'string').forEach(l => links.add(l));
      }
      if (links.size > 0) {
        outboundLinks.set(frontmatter.title, [...links]);
      }
    } catch (err) {
      warnings.push({ file: relPath, error: err.message });
    }
  });

  const backlinks = {};
  for (const [sourceTitle, targets] of outboundLinks) {
    for (const target of targets) {
      const key = target.toLowerCase();
      if (!backlinks[key]) backlinks[key] = [];
      backlinks[key].push(sourceTitle);
    }
  }

  return { index, warnings, backlinks };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/relevance.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: All tests PASS -- the `backlinks` field is additive.

- [ ] **Step 6: Commit**

```bash
git add core/relevance.js tests/relevance.test.js
git commit -m "feat: add backlinks index to buildIndex

buildIndex now extracts outbound links from body wikilinks and
links-to frontmatter, then inverts them into a backlinks map.
Keys are lowercased titles, values are source note titles.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Git keyword scoring in rankNotes

**Files:**
- Modify: `core/relevance.js`
- Modify: `tests/relevance.test.js`

- [ ] **Step 1: Write failing tests for git keyword scoring**

Add to `tests/relevance.test.js` inside the `rankNotes` describe block, after the last existing test:

```javascript
    it('boosts notes matching git keywords in title', () => {
      const ranked = rankNotes(notes, 'my-app', [], ['architecture']);
      expect(ranked[0].title).toBe('Recent Project Note');
      expect(ranked[0].score).toBeGreaterThan(
        rankNotes(notes, 'my-app', [], [])[0].score
      );
    });

    it('boosts notes matching git keywords in tags', () => {
      const ranked = rankNotes(notes, 'my-app', [], ['patterns']);
      const crossProject = ranked.find(n => n.title === 'Old Cross-Project');
      const withoutGit = rankNotes(notes, 'my-app', [], []);
      const crossProjectNoGit = withoutGit.find(n => n.title === 'Old Cross-Project');
      expect(crossProject.score).toBeGreaterThan(crossProjectNoGit.score);
    });

    it('caps git keyword boost at 10 points', () => {
      const manyKeywordNote = {
        title: 'Alpha Bravo Charlie Delta Echo Foxtrot',
        path: '/vault/knowledge/many.md',
        tags: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'],
        project: 'my-app',
        visibility: 'project-only',
        'relevant-to': [],
        updated: '2026-04-04',
      };
      const keywords = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
      const ranked = rankNotes([manyKeywordNote], 'my-app', [], keywords);
      const rankedNoGit = rankNotes([manyKeywordNote], 'my-app', [], []);
      const gitBoost = ranked[0].score - rankedNoGit[0].score;
      expect(gitBoost).toBeLessThanOrEqual(10);
    });

    it('works without git keywords (backwards compatible)', () => {
      const ranked = rankNotes(notes, 'my-app', ['architecture']);
      expect(ranked[0].title).toBe('Recent Project Note');
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/relevance.test.js`

Expected: FAIL -- rankNotes doesn't use git keywords yet.

- [ ] **Step 3: Implement git keyword scoring**

In `core/relevance.js`, replace the `scoreNote` function:

```javascript
function scoreNote(note, currentProject, currentTags, gitKeywords = []) {
  let score = 0;

  if (note.project === currentProject) score += 10;
  if (note['relevant-to'].includes(currentProject)) score += 5;
  if (note.visibility === 'cross-project') score += 2;

  const tagOverlap = note.tags.filter(t => currentTags.includes(t)).length;
  score += tagOverlap * 3;

  if (note.updated) {
    const daysAgo = (Date.now() - new Date(note.updated).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - daysAgo / 30);
  }

  if (gitKeywords.length > 0) {
    let gitScore = 0;
    const titleWords = note.title.toLowerCase().split(/[\s\-_]+/).filter(w => w.length >= 5);
    for (const keyword of gitKeywords) {
      if (titleWords.includes(keyword)) gitScore += 2;
      if (note.tags.some(t => t.toLowerCase() === keyword)) gitScore += 2;
    }
    score += Math.min(gitScore, 10);
  }

  return score;
}
```

Replace the `rankNotes` function:

```javascript
export function rankNotes(index, currentProject, currentTags, gitKeywords = []) {
  return index
    .filter(note => isRelevant(note, currentProject))
    .map(note => ({ ...note, score: scoreNote(note, currentProject, currentTags, gitKeywords) }))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/relevance.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: All tests PASS -- the 4th parameter defaults to `[]`.

- [ ] **Step 6: Commit**

```bash
git add core/relevance.js tests/relevance.test.js
git commit -m "feat: add git keyword scoring to rankNotes

scoreNote now accepts optional gitKeywords parameter. Matching a
note's title word or tag gives +2 per keyword, capped at +10.
rankNotes passes keywords through. Backwards compatible.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SessionStart integration -- extractGitKeywords + cache backlinks

**Files:**
- Modify: `hooks/session-start.runner.js`
- Modify: `tests/hooks/session-start.test.js`

- [ ] **Step 1: Write failing test for backlinks caching**

Add to `tests/hooks/session-start.test.js` inside the main describe, after the last existing test:

```javascript
  it('caches backlinks in the index cache', async () => {
    await writeFile(join(vaultDir, 'knowledge', 'linking-note.md'), `---
title: Linking Note
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
---

See [[Test Pattern]] for details.`);

    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    await exec('node', [runnerPath, configPath]);

    const pointerPath = cachePointerPath();
    const cachePath = (await readFile(pointerPath, 'utf-8')).trim();
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    expect(cached.backlinks).toBeDefined();
    expect(cached.backlinks['test pattern']).toContain('Linking Note');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/hooks/session-start.test.js`

Expected: FAIL -- `cached.backlinks` is undefined.

- [ ] **Step 3: Implement SessionStart changes**

In `hooks/session-start.runner.js`:

**Add import** at the top after existing imports:
```javascript
import { execFileSync } from 'child_process';
```

**Add extractGitKeywords function** before the `run()` function:
```javascript
function extractGitKeywords(cwd) {
  try {
    const keywords = new Set();
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    branch.split(/[/\-_]+/).filter(w => w.length >= 5).forEach(w => keywords.add(w.toLowerCase()));
    const log = execFileSync('git', ['log', '--oneline', '-5', '--format=%s'], { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    log.split(/[\s\-_.,;:!?()\[\]"'`#@/{}]+/).filter(w => w.length >= 5).forEach(w => keywords.add(w.toLowerCase()));
    return [...keywords];
  } catch {
    return [];
  }
}
```

**Update the buildIndex destructuring** (around line 31):

Change:
```javascript
  let index, warnings, backlinks;
```
Note: if the current code says `let index, warnings;` add `backlinks` to the destructuring. Update the try block:
```javascript
    ({ index, warnings, backlinks } = await buildIndex(vaultPath));
```

**Update the cache write** (around line 42):

Change:
```javascript
    await writeFile(cachePath, JSON.stringify({ project, index }));
```
to:
```javascript
    await writeFile(cachePath, JSON.stringify({ project, index, backlinks }));
```

**Update the rankNotes call** (around line 48):

Change:
```javascript
  const relevant = rankNotes(index, project, tags || []).slice(0, 20);
```
to:
```javascript
  const gitKeywords = extractGitKeywords(cwd);
  const relevant = rankNotes(index, project, tags || [], gitKeywords).slice(0, 20);
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
git commit -m "feat: integrate git-context ranking and backlinks caching in SessionStart

SessionStart now extracts git keywords (branch name + recent commits)
and passes them to rankNotes for scoring. Backlinks from buildIndex
are included in the cached index for downstream consumers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Version bump

**Files:**
- Modify: `package.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Bump version in all three files**

Bump from 0.1.12 to 0.1.13 in:
- `package.json` -> `"version"` field
- `.claude-plugin/plugin.json` -> `"version"` field
- `.claude-plugin/marketplace.json` -> `"version"` field in `metadata`

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 0.1.13 for search and backlinks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
