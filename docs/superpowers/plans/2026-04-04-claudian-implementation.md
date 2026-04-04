# Claudian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that turns an Obsidian vault into a persistent, structured knowledge layer accessible from any project.

**Architecture:** Two-layer design — agent-agnostic core (vault spec, frontmatter, config, quality gate) beneath a Claude Code adapter (hooks + skills). Hooks handle automatic reads at session start and nudges on user prompts. Skills handle deliberate writes, search, extraction, linking, and status. The vault is plain markdown with YAML frontmatter, readable by any agent or human.

**Tech Stack:** Node.js (ESM), js-yaml for YAML parsing, vitest for testing. No runtime framework — just modules and scripts.

**Spec:** `docs/superpowers/specs/2026-04-04-claudian-design.md`

---

## File Structure

```
claudian/
├── .claude-plugin/
│   └── plugin.json                  # Plugin metadata (name, version, author, license)
├── package.json                     # ESM, dependencies: js-yaml. devDeps: vitest
├── vitest.config.js                 # Vitest configuration
├── claudian-config.schema.json      # JSON Schema for ~/.claudian/config.yaml
├── hooks/
│   ├── hooks.json                   # Hook event registration
│   ├── run-hook.cmd                 # Windows/Unix polyglot wrapper
│   ├── session-start                # SessionStart hook script (bash)
│   └── user-prompt-submit           # UserPromptSubmit hook script (bash)
├── skills/
│   ├── vault-write/
│   │   └── SKILL.md                 # Create/update vault notes
│   ├── vault-search/
│   │   └── SKILL.md                 # Search vault by content/tags/project
│   ├── vault-extract/
│   │   └── SKILL.md                 # Process ideas/ into structured knowledge
│   ├── vault-link/
│   │   └── SKILL.md                 # Find and create note connections
│   ├── vault-status/
│   │   └── SKILL.md                 # Vault health dashboard
│   └── claudian-init/
│       └── SKILL.md                 # First-run vault setup
├── core/
│   ├── resolver.js                  # Cross-platform path resolution
│   ├── frontmatter.js               # Parse/generate/validate YAML frontmatter
│   ├── config.js                    # Load ~/.claudian/config.yaml, detect project
│   ├── relevance.js                 # Build vault index, rank notes by relevance
│   └── quality-gate.js              # Filter: should this content go in the vault?
├── templates/
│   ├── knowledge.md                 # Template for knowledge notes
│   ├── architecture.md              # Template for architecture/ADR notes
│   ├── pattern.md                   # Template for reusable pattern notes
│   ├── gotcha.md                    # Template for gotcha notes
│   └── spec.md                      # Template for spec notes
└── tests/
    ├── resolver.test.js
    ├── frontmatter.test.js
    ├── config.test.js
    ├── relevance.test.js
    ├── quality-gate.test.js
    └── hooks/
        ├── session-start.test.js
        └── user-prompt-submit.test.js
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.claude-plugin/plugin.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repository**

Run: `cd C:\src\claudian && git init`

- [ ] **Step 2: Create package.json**

```json
{
  "name": "claudian",
  "version": "0.1.0",
  "description": "Obsidian vault as Claude's second brain — a Claude Code plugin for persistent, structured, interlinked knowledge.",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["claude-code", "obsidian", "knowledge-management", "plugin"],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 3: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create .claude-plugin/plugin.json**

```json
{
  "name": "claudian",
  "version": "0.1.0",
  "description": "Obsidian vault as Claude's second brain. Persistent, structured, interlinked knowledge across all your projects.",
  "author": {
    "name": "CyanoTex"
  },
  "repository": "https://github.com/CyanoTex/claudian",
  "license": "MIT",
  "keywords": ["obsidian", "knowledge", "vault", "second-brain"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
Thumbs.db
```

- [ ] **Step 6: Create directory structure**

Run:
```bash
mkdir -p hooks skills core templates tests/hooks setup
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`

- [ ] **Step 8: Verify test runner works**

Create `tests/setup.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('project setup', () => {
  it('vitest runs', () => {
    expect(true).toBe(true);
  });
});
```

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.js .claude-plugin/plugin.json .gitignore tests/setup.test.js
git commit -m "feat: project scaffolding with vitest and plugin metadata"
```

---

### Task 2: core/resolver.js — Cross-Platform Path Resolution

**Files:**
- Create: `core/resolver.js`
- Create: `tests/resolver.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHome, platformDefault, normalizePath } from '../core/resolver.js';
import { homedir } from 'os';

describe('resolver', () => {
  describe('resolveHome', () => {
    it('expands ~ to home directory', () => {
      const home = homedir();
      expect(resolveHome('~/Documents/vault')).toBe(`${home}/Documents/vault`);
    });

    it('expands bare ~ to home directory', () => {
      const home = homedir();
      expect(resolveHome('~')).toBe(home);
    });

    it('leaves absolute paths unchanged', () => {
      expect(resolveHome('/usr/local/bin')).toBe('/usr/local/bin');
    });

    it('leaves relative paths unchanged', () => {
      expect(resolveHome('relative/path')).toBe('relative/path');
    });
  });

  describe('platformDefault', () => {
    it('returns a string containing claudian or Claudian', () => {
      const result = platformDefault();
      expect(result.toLowerCase()).toContain('claudian');
    });
  });

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\test\\vault')).toBe('C:/Users/test/vault');
    });

    it('leaves forward slashes unchanged', () => {
      expect(normalizePath('/home/user/vault')).toBe('/home/user/vault');
    });

    it('collapses redundant separators', () => {
      expect(normalizePath('path//to///vault')).toBe('path/to/vault');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/resolver.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolver.js**

```js
import { homedir } from 'os';
import { normalize, resolve } from 'path';

export function resolveHome(filepath) {
  if (filepath === '~') return normalizePath(homedir());
  if (filepath.startsWith('~/')) {
    return normalizePath(resolve(homedir(), filepath.slice(2)));
  }
  return filepath;
}

export function platformDefault() {
  if (process.platform === 'linux') return '~/claudian-vault';
  return '~/Documents/Claudian-Vault';
}

export function normalizePath(filepath) {
  return normalize(filepath).replace(/\\/g, '/');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/resolver.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/resolver.js tests/resolver.test.js
git commit -m "feat: cross-platform path resolver with home dir expansion"
```

---

### Task 3: core/frontmatter.js — YAML Frontmatter Parse/Generate/Validate

**Files:**
- Create: `core/frontmatter.js`
- Create: `tests/frontmatter.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { parse, generate, validate, VALID_TYPES, VALID_SOURCES } from '../core/frontmatter.js';

describe('frontmatter', () => {
  const validFrontmatter = {
    title: 'Test Note',
    type: 'knowledge',
    project: 'my-project',
    source: 'claude',
    tags: ['test', 'example'],
    created: '2026-04-04',
    updated: '2026-04-04',
    visibility: 'project-only',
    'relevant-to': [],
    'links-to': [],
  };

  describe('parse', () => {
    it('extracts frontmatter and body from markdown', () => {
      const content = `---
title: Test Note
type: knowledge
---

Body content here.`;
      const result = parse(content);
      expect(result.frontmatter.title).toBe('Test Note');
      expect(result.frontmatter.type).toBe('knowledge');
      expect(result.body).toBe('Body content here.');
    });

    it('returns null frontmatter when none present', () => {
      const result = parse('Just a plain markdown file.');
      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe('Just a plain markdown file.');
    });

    it('handles empty body after frontmatter', () => {
      const content = `---
title: Empty
---`;
      const result = parse(content);
      expect(result.frontmatter.title).toBe('Empty');
      expect(result.body).toBe('');
    });
  });

  describe('generate', () => {
    it('produces valid YAML frontmatter block', () => {
      const result = generate({ title: 'Test', type: 'knowledge' });
      expect(result).toContain('---');
      expect(result).toContain('title: Test');
      expect(result).toContain('type: knowledge');
    });

    it('round-trips with parse', () => {
      const generated = generate(validFrontmatter);
      const body = '\nSome body content.';
      const full = generated + '\n' + body;
      const parsed = parse(full);
      expect(parsed.frontmatter.title).toBe('Test Note');
      expect(parsed.frontmatter.type).toBe('knowledge');
      expect(parsed.body).toBe('Some body content.');
    });
  });

  describe('validate', () => {
    it('returns no errors for valid frontmatter', () => {
      expect(validate(validFrontmatter)).toEqual([]);
    });

    it('reports missing required fields', () => {
      const errors = validate({ title: 'Incomplete' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('type'))).toBe(true);
    });

    it('reports invalid type', () => {
      const errors = validate({ ...validFrontmatter, type: 'invalid' });
      expect(errors.some(e => e.includes('type'))).toBe(true);
    });

    it('reports invalid source', () => {
      const errors = validate({ ...validFrontmatter, source: 'gpt' });
      expect(errors.some(e => e.includes('source'))).toBe(true);
    });

    it('reports invalid visibility', () => {
      const errors = validate({ ...validFrontmatter, visibility: 'secret' });
      expect(errors.some(e => e.includes('visibility'))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/frontmatter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement frontmatter.js**

```js
import yaml from 'js-yaml';

export const VALID_TYPES = ['knowledge', 'architecture', 'idea', 'spec', 'pattern', 'gotcha'];
export const VALID_SOURCES = ['claude', 'human', 'extracted'];
export const VALID_VISIBILITY = ['project-only', 'cross-project'];
const REQUIRED_FIELDS = ['title', 'type', 'project', 'source', 'tags', 'created', 'updated'];

export function parse(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  return {
    frontmatter: yaml.load(match[1]),
    body: match[2].trim(),
  };
}

export function generate(frontmatter) {
  const yamlStr = yaml.dump(frontmatter, { lineWidth: -1, sortKeys: true }).trim();
  return `---\n${yamlStr}\n---`;
}

export function validate(frontmatter) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (frontmatter.type && !VALID_TYPES.includes(frontmatter.type)) {
    errors.push(`Invalid type: "${frontmatter.type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (frontmatter.source && !VALID_SOURCES.includes(frontmatter.source)) {
    errors.push(`Invalid source: "${frontmatter.source}". Must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (frontmatter.visibility && !VALID_VISIBILITY.includes(frontmatter.visibility)) {
    errors.push(`Invalid visibility: "${frontmatter.visibility}". Must be one of: ${VALID_VISIBILITY.join(', ')}`);
  }

  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/frontmatter.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/frontmatter.js tests/frontmatter.test.js
git commit -m "feat: YAML frontmatter parser, generator, and validator"
```

---

### Task 4: core/config.js — Config Loading and Project Detection

**Files:**
- Create: `core/config.js`
- Create: `tests/config.test.js`

**Depends on:** Task 2 (core/resolver.js)

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadFrom, detectProject, CONFIG_FILENAME } from '../core/config.js';

describe('config', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `claudian-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadFrom', () => {
    it('loads and parses a valid config file', async () => {
      const configPath = join(tempDir, CONFIG_FILENAME);
      await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ~/Documents/Claudian-Vault
    mode: single
    projects:
      my-app:
        repo: ~/src/my-app
        tags: [javascript, web]
capabilities:
  obsidian-cli: auto-detect
`);
      const config = await loadFrom(configPath);
      expect(config.version).toBe(1);
      expect(config.vaults).toHaveLength(1);
      expect(config.vaults[0].name).toBe('main');
      expect(config.vaults[0].projects['my-app'].tags).toContain('javascript');
    });

    it('throws on missing config file', async () => {
      await expect(loadFrom(join(tempDir, 'nonexistent.yaml'))).rejects.toThrow();
    });

    it('throws on invalid YAML', async () => {
      const configPath = join(tempDir, CONFIG_FILENAME);
      await writeFile(configPath, '{{{{invalid yaml');
      await expect(loadFrom(configPath)).rejects.toThrow();
    });
  });

  describe('detectProject', () => {
    const config = {
      vaults: [{
        name: 'main',
        path: '/home/user/vault',
        mode: 'single',
        projects: {
          'my-app': { repo: '/home/user/src/my-app', tags: ['web'] },
          'my-lib': { repo: '/home/user/src/my-lib', tags: ['lib'] },
        },
      }],
    };

    it('detects project from cwd matching a registered repo', () => {
      const result = detectProject(config, '/home/user/src/my-app');
      expect(result.project).toBe('my-app');
      expect(result.tags).toContain('web');
    });

    it('detects project from a subdirectory of a registered repo', () => {
      const result = detectProject(config, '/home/user/src/my-app/packages/core');
      expect(result.project).toBe('my-app');
    });

    it('returns null project for unregistered cwd', () => {
      const result = detectProject(config, '/home/user/src/unknown-project');
      expect(result.project).toBeNull();
    });

    it('always returns a vault even when project is null', () => {
      const result = detectProject(config, '/somewhere/else');
      expect(result.vault).toBeDefined();
      expect(result.vault.name).toBe('main');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/config.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config.js**

```js
import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { resolveHome, normalizePath } from './resolver.js';

export const CONFIG_FILENAME = 'config.yaml';

export function globalConfigPath() {
  return resolveHome('~/.claudian/' + CONFIG_FILENAME);
}

export async function load() {
  return loadFrom(globalConfigPath());
}

export async function loadFrom(configPath) {
  const content = await readFile(configPath, 'utf-8');
  const config = yaml.load(content);
  if (!config || !config.vaults) {
    throw new Error('Invalid Claudian config: missing "vaults" key');
  }
  return config;
}

export function detectProject(config, cwd) {
  const normalCwd = normalizePath(cwd);

  for (const vault of config.vaults) {
    for (const [name, project] of Object.entries(vault.projects || {})) {
      const repoPath = normalizePath(resolveHome(project.repo));
      if (normalCwd === repoPath || normalCwd.startsWith(repoPath + '/')) {
        return { vault, project: name, ...project };
      }
    }
  }

  return { vault: config.vaults[0], project: null, tags: [] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/config.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/config.js tests/config.test.js
git commit -m "feat: config loading and project detection from cwd"
```

---

### Task 5: core/relevance.js — Vault Index and Note Ranking

**Files:**
- Create: `core/relevance.js`
- Create: `tests/relevance.test.js`

**Depends on:** Task 3 (core/frontmatter.js)

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildIndex, rankNotes } from '../core/relevance.js';

describe('relevance', () => {
  let vaultDir;

  beforeEach(async () => {
    vaultDir = join(tmpdir(), `claudian-vault-test-${Date.now()}`);
    await mkdir(join(vaultDir, 'projects', 'my-app'), { recursive: true });
    await mkdir(join(vaultDir, 'knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'ideas'), { recursive: true });
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  describe('buildIndex', () => {
    it('indexes notes with frontmatter', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'test-note.md'), `---
title: Test Pattern
type: knowledge
project: cross-project
source: claude
tags: [testing, patterns]
created: '2026-04-04'
updated: '2026-04-04'
visibility: cross-project
relevant-to: []
links-to: []
---

Some content about testing patterns.`);

      const index = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].title).toBe('Test Pattern');
      expect(index[0].tags).toContain('testing');
      expect(index[0].path).toContain('test-note.md');
    });

    it('skips files without frontmatter', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'plain.md'), 'No frontmatter here.');
      const index = await buildIndex(vaultDir);
      expect(index).toHaveLength(0);
    });

    it('indexes notes in nested project folders', async () => {
      await writeFile(join(vaultDir, 'projects', 'my-app', 'architecture.md'), `---
title: App Architecture
type: architecture
project: my-app
source: claude
tags: [architecture]
created: '2026-04-04'
updated: '2026-04-04'
visibility: project-only
relevant-to: []
links-to: []
---

Architecture notes.`);

      const index = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].project).toBe('my-app');
    });
  });

  describe('rankNotes', () => {
    const notes = [
      {
        title: 'Old Cross-Project',
        path: '/vault/knowledge/old.md',
        tags: ['patterns'],
        project: 'cross-project',
        visibility: 'cross-project',
        'relevant-to': ['my-app'],
        updated: '2026-01-01',
      },
      {
        title: 'Recent Project Note',
        path: '/vault/projects/my-app/recent.md',
        tags: ['architecture'],
        project: 'my-app',
        visibility: 'project-only',
        'relevant-to': [],
        updated: '2026-04-04',
      },
      {
        title: 'Unrelated Note',
        path: '/vault/projects/other/unrelated.md',
        tags: ['unrelated'],
        project: 'other-project',
        visibility: 'project-only',
        'relevant-to': [],
        updated: '2026-04-03',
      },
    ];

    it('ranks project-specific notes higher', () => {
      const ranked = rankNotes(notes, 'my-app', ['architecture']);
      expect(ranked[0].title).toBe('Recent Project Note');
    });

    it('includes cross-project notes targeted at current project', () => {
      const ranked = rankNotes(notes, 'my-app', ['patterns']);
      const titles = ranked.map(n => n.title);
      expect(titles).toContain('Old Cross-Project');
    });

    it('excludes unrelated project-only notes', () => {
      const ranked = rankNotes(notes, 'my-app', []);
      const titles = ranked.map(n => n.title);
      expect(titles).not.toContain('Unrelated Note');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/relevance.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement relevance.js**

```js
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { parse } from './frontmatter.js';
import { normalizePath } from './resolver.js';

export async function buildIndex(vaultDir) {
  const index = [];
  await walkDir(vaultDir, async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const relPath = normalizePath(relative(vaultDir, filePath));
    if (relPath.startsWith('.obsidian/') || relPath.startsWith('meta/templates/')) return;

    const content = await readFile(filePath, 'utf-8');
    const { frontmatter } = parse(content);
    if (!frontmatter || !frontmatter.title) return;

    index.push({
      title: frontmatter.title,
      path: normalizePath(filePath),
      relPath,
      type: frontmatter.type,
      project: frontmatter.project,
      source: frontmatter.source,
      tags: frontmatter.tags || [],
      visibility: frontmatter.visibility || 'project-only',
      'relevant-to': frontmatter['relevant-to'] || [],
      updated: frontmatter.updated || frontmatter.created,
    });
  });
  return index;
}

export function rankNotes(index, currentProject, currentTags) {
  return index
    .filter(note => isRelevant(note, currentProject))
    .map(note => ({ ...note, score: scoreNote(note, currentProject, currentTags) }))
    .sort((a, b) => b.score - a.score);
}

function isRelevant(note, currentProject) {
  if (note.project === currentProject) return true;
  if (note.project === 'cross-project' || note.visibility === 'cross-project') return true;
  if (note['relevant-to'].includes(currentProject)) return true;
  return false;
}

function scoreNote(note, currentProject, currentTags) {
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

  return score;
}

async function walkDir(dir, callback) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      await walkDir(fullPath, callback);
    } else {
      await callback(fullPath);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/relevance.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/relevance.js tests/relevance.test.js
git commit -m "feat: vault index builder and relevance-based note ranking"
```

---

### Task 6: core/quality-gate.js — Write Filtering

**Files:**
- Create: `core/quality-gate.js`
- Create: `tests/quality-gate.test.js`

**Depends on:** Task 3 (core/frontmatter.js), Task 5 (core/relevance.js)

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { evaluate, REJECT, WRITE, UPDATE } from '../core/quality-gate.js';

describe('quality-gate', () => {
  const validNote = {
    title: 'DataStore Session Locking',
    type: 'architecture',
    project: 'my-project',
    source: 'claude',
    tags: ['datastore', 'concurrency'],
    body: 'DataStore session locking prevents data corruption by ensuring only one server handles a player\'s data at a time.',
  };

  describe('frontmatter validation', () => {
    it('rejects notes missing a title', () => {
      const result = evaluate({ ...validNote, title: '' }, []);
      expect(result.action).toBe(REJECT);
      expect(result.reason).toContain('title');
    });

    it('rejects notes with no tags', () => {
      const result = evaluate({ ...validNote, tags: [] }, []);
      expect(result.action).toBe(REJECT);
      expect(result.reason).toContain('tag');
    });
  });

  describe('ephemera detection', () => {
    it('rejects session-scoped observations', () => {
      const note = {
        ...validNote,
        title: 'Debug Session Notes',
        body: 'We tried refactoring the handler but it broke the tests. Reverted.',
      };
      const result = evaluate(note, []);
      expect(result.action).toBe(REJECT);
      expect(result.reason).toContain('ephemer');
    });

    it('rejects user preference notes', () => {
      const note = {
        ...validNote,
        title: 'User Preferences',
        body: 'User prefers terse responses and no emojis.',
      };
      const result = evaluate(note, []);
      expect(result.action).toBe(REJECT);
    });
  });

  describe('duplicate detection', () => {
    const existingIndex = [
      {
        title: 'DataStore Session Locking',
        path: '/vault/knowledge/datastore-locking.md',
        tags: ['datastore', 'concurrency'],
        project: 'my-project',
      },
    ];

    it('suggests update when a note with the same title exists', () => {
      const result = evaluate(validNote, existingIndex);
      expect(result.action).toBe(UPDATE);
      expect(result.existingPath).toContain('datastore-locking.md');
    });

    it('allows write when no duplicate exists', () => {
      const note = { ...validNote, title: 'Completely New Topic' };
      const result = evaluate(note, []);
      expect(result.action).toBe(WRITE);
    });
  });

  describe('durable knowledge check', () => {
    it('accepts architecture descriptions', () => {
      const result = evaluate(validNote, []);
      expect(result.action).toBe(WRITE);
    });

    it('accepts cross-project patterns', () => {
      const note = {
        ...validNote,
        title: 'Error Handling Pattern',
        type: 'pattern',
        body: 'All service calls should use a Result type wrapper instead of throwing exceptions. This prevents unhandled rejections and makes error paths explicit.',
      };
      const result = evaluate(note, []);
      expect(result.action).toBe(WRITE);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/quality-gate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement quality-gate.js**

```js
export const WRITE = 'write';
export const UPDATE = 'update';
export const REJECT = 'reject';

const EPHEMERA_PATTERNS = [
  /\b(tried|reverted|broke|debugging|fixed the bug|session)\b/i,
  /\b(user prefers|user wants|user likes)\b/i,
  /\b(today we|this session|just now|earlier today)\b/i,
  /\b(attempting to|trying to fix|reverting)\b/i,
];

export function evaluate(note, existingIndex) {
  const validationError = validateBasics(note);
  if (validationError) return { action: REJECT, reason: validationError };

  if (isEphemera(note)) {
    return { action: REJECT, reason: 'Content appears to be session ephemera, not durable knowledge.' };
  }

  const duplicate = findDuplicate(note, existingIndex);
  if (duplicate) {
    return { action: UPDATE, reason: `Similar note exists: "${duplicate.title}"`, existingPath: duplicate.path };
  }

  return { action: WRITE, reason: 'Passes quality gate.' };
}

function validateBasics(note) {
  if (!note.title || note.title.trim() === '') return 'Note must have a title.';
  if (!note.tags || note.tags.length === 0) return 'Note must have at least one tag.';
  return null;
}

function isEphemera(note) {
  const text = `${note.title} ${note.body || ''}`;
  return EPHEMERA_PATTERNS.some(pattern => pattern.test(text));
}

function findDuplicate(note, existingIndex) {
  const normalTitle = note.title.toLowerCase().trim();
  return existingIndex.find(existing =>
    existing.title.toLowerCase().trim() === normalTitle
  ) || null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/quality-gate.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/quality-gate.js tests/quality-gate.test.js
git commit -m "feat: quality gate for vault writes — ephemera detection and dedup"
```

---

### Task 7: Vault Templates and Config Schema

**Files:**
- Create: `templates/knowledge.md`
- Create: `templates/architecture.md`
- Create: `templates/pattern.md`
- Create: `templates/gotcha.md`
- Create: `templates/spec.md`
- Create: `claudian-config.schema.json`

- [ ] **Step 1: Create knowledge template**

```markdown
---
title: "{{title}}"
type: knowledge
project: "{{project}}"
source: "{{source}}"
tags: [{{tags}}]
created: "{{date}}"
updated: "{{date}}"
visibility: project-only
relevant-to: []
links-to: []
---

## Summary

{{Brief description of what this knowledge covers.}}

## Details

{{Detailed explanation. Use wikilinks like [[Related Note]] to connect ideas.}}

## References

{{Links to source material, docs, or related vault notes.}}
```

- [ ] **Step 2: Create architecture template**

```markdown
---
title: "{{title}}"
type: architecture
project: "{{project}}"
source: "{{source}}"
tags: [{{tags}}]
created: "{{date}}"
updated: "{{date}}"
visibility: project-only
relevant-to: []
links-to: []
---

## Context

{{What problem does this architecture solve? What constraints exist?}}

## Decision

{{What was decided and why.}}

## Consequences

{{What follows from this decision — tradeoffs, risks, benefits.}}

## Related

{{Wikilinks to related architecture notes, patterns, or specs.}}
```

- [ ] **Step 3: Create pattern template**

```markdown
---
title: "{{title}}"
type: pattern
project: "{{project}}"
source: "{{source}}"
tags: [{{tags}}]
created: "{{date}}"
updated: "{{date}}"
visibility: cross-project
relevant-to: []
links-to: []
---

## Problem

{{What recurring problem does this pattern solve?}}

## Solution

{{The pattern itself. Include code examples if applicable.}}

## When to Use

{{Conditions where this pattern applies.}}

## When Not to Use

{{Conditions where this pattern is a bad fit.}}

## Known Uses

{{Links to projects or notes where this pattern is applied.}}
```

- [ ] **Step 4: Create gotcha template**

```markdown
---
title: "{{title}}"
type: gotcha
project: "{{project}}"
source: "{{source}}"
tags: [{{tags}}]
created: "{{date}}"
updated: "{{date}}"
visibility: cross-project
relevant-to: []
links-to: []
---

## The Gotcha

{{What goes wrong and why it's surprising.}}

## How to Detect

{{Symptoms that indicate you've hit this gotcha.}}

## Fix

{{How to resolve it.}}

## Prevention

{{How to avoid hitting this in the future.}}
```

- [ ] **Step 5: Create spec template**

```markdown
---
title: "{{title}}"
type: spec
project: "{{project}}"
source: "{{source}}"
tags: [{{tags}}]
created: "{{date}}"
updated: "{{date}}"
visibility: project-only
relevant-to: []
links-to: []
---

## Overview

{{What is being specified and why.}}

## Requirements

{{What must be true for this to be considered complete.}}

## Design

{{How it works — architecture, data flow, components.}}

## Open Questions

{{Unresolved decisions or unknowns.}}
```

- [ ] **Step 6: Create config schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Claudian Configuration",
  "description": "Schema for ~/.claudian/config.yaml",
  "type": "object",
  "required": ["version", "vaults"],
  "properties": {
    "version": {
      "type": "integer",
      "const": 1
    },
    "vaults": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "path", "mode"],
        "properties": {
          "name": {
            "type": "string",
            "description": "Human-readable vault identifier"
          },
          "path": {
            "type": "string",
            "description": "Vault directory path. Supports ~ for home directory."
          },
          "mode": {
            "type": "string",
            "enum": ["single", "per-project"],
            "description": "single = one vault for all projects. per-project = separate vault per project."
          },
          "projects": {
            "type": "object",
            "additionalProperties": {
              "type": "object",
              "required": ["repo", "tags"],
              "properties": {
                "repo": {
                  "type": "string",
                  "description": "Path to project repository. Supports ~ for home directory."
                },
                "tags": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "Tags identifying this project's domain."
                }
              }
            }
          }
        }
      }
    },
    "capabilities": {
      "type": "object",
      "description": "Capability detection settings. 'auto-detect' or null.",
      "additionalProperties": {
        "type": ["string", "null"],
        "enum": ["auto-detect", null]
      }
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add templates/ claudian-config.schema.json
git commit -m "feat: vault note templates and config JSON schema"
```

---

### Task 8: Hook Infrastructure

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/run-hook.cmd`

- [ ] **Step 1: Create hooks.json**

```json
{
  "description": "Claudian — Obsidian vault as Claude's second brain",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "timeout": 30
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" user-prompt-submit",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Create run-hook.cmd polyglot wrapper**

This file must work as both a Windows batch file and a Unix bash script:

```cmd
: ; # This is a bash/batch polyglot — DO NOT EDIT the first line
: ; exec bash "${0}" "${@}"
@echo off
setlocal

:: Windows: find bash and run the named hook script
where bash >nul 2>nul
if %errorlevel% neq 0 (
    echo {"hookSpecificOutput":{"additionalContext":"[Claudian] bash not found on PATH"}} 1>&2
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
bash "%SCRIPT_DIR%%1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%
```

After the `exit /b` line, add a blank line, then the bash portion (which runs via the `exec bash` on line 2):

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="$1"
shift

if [[ -f "$SCRIPT_DIR/$HOOK_NAME" ]]; then
    exec bash "$SCRIPT_DIR/$HOOK_NAME" "$@"
else
    echo "{\"hookSpecificOutput\":{\"additionalContext\":\"[Claudian] Hook not found: $HOOK_NAME\"}}"
fi
```

- [ ] **Step 3: Commit**

```bash
git add hooks/hooks.json hooks/run-hook.cmd
git commit -m "feat: hook infrastructure — hooks.json and cross-platform polyglot wrapper"
```

---

### Task 9: SessionStart Hook

**Files:**
- Create: `hooks/session-start` (bash script, no extension)
- Create: `tests/hooks/session-start.test.js`

**Depends on:** Task 4 (config.js), Task 5 (relevance.js), Task 8 (hook infra)

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

describe('session-start hook', () => {
  let vaultDir;
  let configDir;
  let configPath;

  beforeEach(async () => {
    const base = join(tmpdir(), `claudian-hook-test-${Date.now()}`);
    vaultDir = join(base, 'vault');
    configDir = join(base, 'config');
    configPath = join(configDir, 'config.yaml');

    await mkdir(join(vaultDir, 'projects', 'test-project'), { recursive: true });
    await mkdir(join(vaultDir, 'knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'ideas'), { recursive: true });
    await mkdir(configDir, { recursive: true });

    await writeFile(join(vaultDir, 'knowledge', 'test-note.md'), `---
title: Test Pattern
type: knowledge
project: cross-project
source: claude
tags: [testing]
created: '2026-04-04'
updated: '2026-04-04'
visibility: cross-project
relevant-to: []
links-to: []
---

A test pattern note.`);

    await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ${vaultDir.replace(/\\/g, '/')}
    mode: single
    projects:
      test-project:
        repo: ${join(base, 'repos', 'test-project').replace(/\\/g, '/')}
        tags: [testing]
capabilities:
  obsidian-cli: auto-detect
`);
  });

  afterEach(async () => {
    const base = join(vaultDir, '..');
    await rm(base, { recursive: true, force: true });
  });

  it('outputs valid JSON with vault context', async () => {
    const hookScript = join(process.cwd(), 'hooks', 'session-start');
    const { stdout } = await exec('node', [
      join(process.cwd(), 'hooks', 'session-start.runner.js'),
      configPath,
      vaultDir,
    ]);

    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.additionalContext).toContain('Claudian');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/session-start.test.js`
Expected: FAIL — script not found.

- [ ] **Step 3: Create session-start.runner.js (Node.js entry point for the hook)**

The bash script delegates to a Node.js runner for portability and testability:

```js
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex, rankNotes } from '../core/relevance.js';
import { resolveHome } from '../core/resolver.js';

const configPath = process.argv[2] || resolveHome('~/.claudian/config.yaml');

async function run() {
  let config;
  try {
    config = await loadFrom(configPath);
  } catch (err) {
    output(`[Claudian] Config not found at ${configPath}. Run /claudian-init to set up.`);
    return;
  }

  const cwd = process.cwd();
  const { vault, project, tags } = detectProject(config, cwd);
  const vaultPath = resolveHome(vault.path);

  let index;
  try {
    index = await buildIndex(vaultPath);
  } catch (err) {
    output(`[Claudian] Could not read vault at ${vaultPath}: ${err.message}`);
    return;
  }

  const relevant = rankNotes(index, project, tags || []).slice(0, 20);

  const lines = [
    `# Claudian Vault Context`,
    ``,
    `**Vault:** ${vault.name} (${vaultPath})`,
    `**Project:** ${project || 'unregistered'}`,
    `**Notes indexed:** ${index.length}`,
    ``,
  ];

  if (relevant.length > 0) {
    lines.push(`## Relevant Notes`);
    lines.push(``);
    lines.push(`| Title | Type | Tags | Path |`);
    lines.push(`|---|---|---|---|`);
    for (const note of relevant) {
      lines.push(`| ${note.title} | ${note.type} | ${note.tags.join(', ')} | ${note.relPath} |`);
    }
    lines.push(``);
    lines.push(`Use vault-search to find more notes or read a specific note by path.`);
  } else {
    lines.push(`No relevant notes found. Use vault-write to start building knowledge.`);
  }

  output(lines.join('\n'));
}

function output(text) {
  const result = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: text,
    },
  };
  process.stdout.write(JSON.stringify(result));
}

run().catch(err => {
  output(`[Claudian] Error: ${err.message}`);
});
```

Create file at `hooks/session-start.runner.js`.

- [ ] **Step 4: Create session-start bash script**

Create file at `hooks/session-start` (no extension):

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

node "$PLUGIN_ROOT/hooks/session-start.runner.js" "$@"
```

Make it executable: `chmod +x hooks/session-start`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/hooks/session-start.test.js`
Expected: Test passes — output is valid JSON with vault context.

- [ ] **Step 6: Commit**

```bash
git add hooks/session-start hooks/session-start.runner.js tests/hooks/session-start.test.js
git commit -m "feat: SessionStart hook — inject vault context at session begin"
```

---

### Task 10: UserPromptSubmit Hook

**Files:**
- Create: `hooks/user-prompt-submit` (bash script)
- Create: `hooks/user-prompt-submit.runner.js`
- Create: `tests/hooks/user-prompt-submit.test.js`

**Depends on:** Task 8 (hook infra)

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from 'vitest';
import { matchKeywords } from '../hooks/user-prompt-submit.runner.js';

describe('user-prompt-submit', () => {
  const index = [
    { title: 'DataStore Locking', tags: ['datastore', 'concurrency'], relPath: 'knowledge/datastore.md' },
    { title: 'Error Handling Pattern', tags: ['errors', 'patterns'], relPath: 'knowledge/errors.md' },
    { title: 'OSRPS Architecture', tags: ['architecture', 'game'], relPath: 'projects/my-game/arch.md' },
  ];

  describe('matchKeywords', () => {
    it('matches note titles in user message', () => {
      const matches = matchKeywords('How does DataStore locking work?', index);
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe('DataStore Locking');
    });

    it('matches tags in user message', () => {
      const matches = matchKeywords('We need better error handling here', index);
      expect(matches.some(m => m.title === 'Error Handling Pattern')).toBe(true);
    });

    it('returns empty array when nothing matches', () => {
      const matches = matchKeywords('What is the weather today?', index);
      expect(matches).toHaveLength(0);
    });

    it('deduplicates matches', () => {
      const matches = matchKeywords('DataStore DataStore DataStore', index);
      expect(matches).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/user-prompt-submit.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement user-prompt-submit.runner.js**

```js
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex } from '../core/relevance.js';
import { resolveHome } from '../core/resolver.js';

export function matchKeywords(message, index) {
  const messageLower = message.toLowerCase();
  const matched = new Map();

  for (const note of index) {
    const titleWords = note.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const titleMatch = titleWords.some(word => messageLower.includes(word));

    const tagMatch = note.tags.some(tag => messageLower.includes(tag.toLowerCase()));

    if (titleMatch || tagMatch) {
      matched.set(note.relPath, note);
    }
  }

  return Array.from(matched.values());
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

  let config;
  try {
    config = await loadFrom(resolveHome('~/.claudian/config.yaml'));
  } catch {
    emptyOutput();
    return;
  }

  const { vault, project } = detectProject(config, process.cwd());
  const vaultPath = resolveHome(vault.path);

  let index;
  try {
    index = await buildIndex(vaultPath);
  } catch {
    emptyOutput();
    return;
  }

  const matches = matchKeywords(userMessage, index);

  if (matches.length === 0) {
    emptyOutput();
    return;
  }

  const noteList = matches.slice(0, 5).map(n => `[[${n.title}]] (${n.relPath})`).join(', ');
  const context = `[Claudian] Vault may have relevant notes: ${noteList}. Consider vault-search.`;

  const result = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  };
  process.stdout.write(JSON.stringify(result));
}

function emptyOutput() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: '',
    },
  }));
}

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  run().catch(() => emptyOutput());
}
```

- [ ] **Step 4: Create user-prompt-submit bash script**

Create file at `hooks/user-prompt-submit` (no extension):

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

node "$PLUGIN_ROOT/hooks/user-prompt-submit.runner.js"
```

Make it executable: `chmod +x hooks/user-prompt-submit`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/hooks/user-prompt-submit.test.js`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add hooks/user-prompt-submit hooks/user-prompt-submit.runner.js tests/hooks/user-prompt-submit.test.js
git commit -m "feat: UserPromptSubmit hook — keyword matching nudge toward vault"
```

---

### Task 11: Skills — vault-write, vault-search, vault-extract, vault-link, vault-status, claudian-init

**Files:**
- Create: `skills/vault-write/SKILL.md`
- Create: `skills/vault-search/SKILL.md`
- Create: `skills/vault-extract/SKILL.md`
- Create: `skills/vault-link/SKILL.md`
- Create: `skills/vault-status/SKILL.md`
- Create: `skills/claudian-init/SKILL.md`

Skills are markdown instruction files — no unit tests, but they must follow the SKILL.md frontmatter convention.

- [ ] **Step 1: Create vault-write skill**

`skills/vault-write/SKILL.md`:

````markdown
---
name: vault-write
description: Create or update a note in the Claudian Obsidian vault. Use when you learn something that would be useful in a future session on a different day — architecture decisions, reusable patterns, cross-project gotchas, or synthesized insights. Do NOT use for session observations, debugging notes, or user preferences (those belong in claude-mem or session memory).
---

# vault-write

Create or update a note in the Claudian Obsidian vault.

## When to Use

Write to the vault when you encounter knowledge that is:
- **Durable** — useful beyond this session, on a different day
- **Structured** — benefits from links, tags, and frontmatter
- **Reusable** — relevant to future work on this or other projects

Do NOT write:
- Session observations ("we tried X") — that's claude-mem territory
- User preferences ("user likes terse output") — that's session memory
- Debugging steps or fix attempts — ephemeral by nature
- Anything scoped to a single session's timeline

## How to Use

1. **Determine the note type:** knowledge, architecture, pattern, gotcha, or spec
2. **Read the template** from the vault's `meta/templates/` folder (or from the plugin's `templates/` folder)
3. **Check for duplicates** by searching the vault for notes with similar titles or tags
4. **Write the note** with complete frontmatter:

```yaml
---
title: "Descriptive Title"
type: knowledge | architecture | pattern | gotcha | spec
project: project-name | cross-project
source: claude
tags: [relevant, tags, here]
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
visibility: project-only | cross-project
relevant-to: []
links-to: []
---
```

5. **Add wikilinks** in the body to connect to related notes: `[[Related Note Title]]`
6. **Place the file** in the correct vault folder:
   - `projects/<project-name>/` for project-specific notes
   - `knowledge/` for cross-project knowledge
   - `architecture/` for architecture decisions and ADRs

## Cross-Project Notes

When you discover knowledge relevant to other projects, set:
```yaml
visibility: cross-project
relevant-to: [project-b, project-c]
```

If claudy-talky or claude-peers are available and the target project has a running agent, send a brief notification referencing the new note.

## File Naming

Use kebab-case derived from the title: `session-locking-in-datastores.md`

## Quality Gate

Before writing, ask yourself:
1. Would claude-mem capture this? If yes, don't write it.
2. Would this be useful in a future session on a different day? If no, don't write it.
3. Does a similar note already exist? If yes, update it instead.
````

- [ ] **Step 2: Create vault-search skill**

`skills/vault-search/SKILL.md`:

````markdown
---
name: vault-search
description: Search the Claudian Obsidian vault by content, tags, project, or note type. Use when you need context from the vault, when the SessionStart hook surfaced relevant notes, or when the UserPromptSubmit hook nudged you toward vault content.
---

# vault-search

Search the Claudian vault for relevant knowledge.

## How to Search

Read the vault config from `~/.claudian/config.yaml` to find the vault path, then use these approaches:

### By tags
```bash
grep -rl "tags:.*\[.*datastore.*\]" <vault-path>/ --include="*.md"
```

### By project
Read all `.md` files in `<vault-path>/projects/<project-name>/`

### By content
```bash
grep -rl "search term" <vault-path>/ --include="*.md"
```

### By note type
```bash
grep -rl "type: pattern" <vault-path>/ --include="*.md"
```

### Structured query syntax
Users or hooks may suggest queries like `tag:datastore project:my-project type:gotcha`. Parse these into the corresponding search operations above.

## Presenting Results

Return a summary table:

| Title | Type | Tags | Path |
|---|---|---|---|
| Note Title | knowledge | tag1, tag2 | relative/path.md |

Then read the full content of the most relevant notes to provide context.

## When Obsidian CLI is Available

If `obsidian` is on PATH and Obsidian is running, prefer:
```bash
obsidian search query="search term" format=json
```
This provides richer results including Obsidian's own relevance ranking.
````

- [ ] **Step 3: Create vault-extract skill**

`skills/vault-extract/SKILL.md`:

````markdown
---
name: vault-extract
description: Process the user's freeform notes in the vault's ideas/ folder into structured knowledge notes. Use when SessionStart flags unprocessed ideas, or when the user asks you to look at their ideas.
---

# vault-extract

Process freeform idea notes into structured vault knowledge.

## The ideas/ Folder

The `ideas/` folder in the vault belongs to the user. They write freeform thoughts, proposals, and brainstorms there. You may READ these notes but NEVER write directly into `ideas/`.

## How to Extract

1. **Read the idea note** in full
2. **Identify extractable knowledge:**
   - Architectural decisions or proposals
   - Requirements or constraints
   - Reusable patterns or concepts
   - Questions that need answers
   - Cross-project connections
3. **Propose structured notes** — show the user exactly what you would create:
   - Note title, type, tags, target folder
   - A brief preview of the content
4. **Wait for user approval** — this skill transforms the user's thinking, so it ALWAYS asks before writing
5. **On approval:** Create the notes using vault-write conventions with `source: extracted`
6. **Flag the original idea:** Add to the idea's frontmatter:
   ```yaml
   processed: true
   extracted-to:
     - knowledge/extracted-note-title.md
     - architecture/decision-title.md
   ```

## Key Rule

Never skip step 4. Always show the user what you plan to extract and get explicit approval before creating notes.
````

- [ ] **Step 4: Create vault-link skill**

`skills/vault-link/SKILL.md`:

````markdown
---
name: vault-link
description: Find and create connections between existing vault notes. Use after writing a new note, or when you notice notes that should reference each other but don't.
---

# vault-link

Strengthen the vault's knowledge graph by finding and creating connections between notes.

## How to Link

1. **Read the target note** — understand its content, tags, and existing links
2. **Search for related notes** using:
   - Shared tags
   - Similar titles or topics
   - References to the same concepts
   - Notes in the same project that cover adjacent topics
3. **Suggest wikilinks** with reasoning:
   - "[[Error Handling Pattern]] — this note's retry logic implements that pattern"
   - "[[Project - MyApp Architecture]] — the DataStore design is part of this system"
4. **Update both notes** if appropriate — add the wikilink to each note's body or `links-to` frontmatter field

## Wikilink Conventions

- `[[Note Title]]` for inline references in body text
- `links-to` frontmatter array for explicit structural relationships
- Project index notes use the format `[[Project - ProjectName]]`

## When to Run

- After vault-write creates a new note (suggest links automatically)
- When vault-status reports orphan notes (notes with no inbound links)
- When the user asks you to organize or connect vault content
````

- [ ] **Step 5: Create vault-status skill**

`skills/vault-status/SKILL.md`:

````markdown
---
name: vault-status
description: Show vault health — orphan notes, stale content, unprocessed ideas, tag coverage, missing frontmatter. Use periodically or when asked about vault state.
---

# vault-status

Report on the health and state of the Claudian vault.

## What to Report

Read the vault config from `~/.claudian/config.yaml`, resolve the vault path, then analyze:

### Orphan Notes
Notes with no inbound wikilinks from other notes. Search all `.md` files for `[[Note Title]]` references. Notes that are never linked to are orphans.

### Stale Notes
Notes where `updated` in frontmatter is older than 30 days but the note is still referenced by other notes. These may contain outdated information.

### Unprocessed Ideas
Notes in `ideas/` that don't have `processed: true` in frontmatter.

### Tag Distribution
Count notes per tag. Show which tags are heavily used and which are sparse.

### Project Coverage
Count notes per project. Flag projects with very few notes.

### Missing Frontmatter
Notes that exist but are missing required frontmatter fields (title, type, project, source, tags, created, updated).

## Output Format

Present as a concise dashboard:

```
Claudian Vault Health
━━━━━━━━━━━━━━━━━━━━
Notes: 47 total (32 knowledge, 8 architecture, 4 pattern, 3 gotcha)
Orphans: 3 notes with no inbound links
Stale: 2 notes older than 30 days still referenced
Unprocessed ideas: 5
Missing frontmatter: 1

Top tags: roblox (23), datastore (12), architecture (8), patterns (7)
Projects: my-app (18), my-lib (12), cross-project (17)
```
````

- [ ] **Step 6: Create claudian-init skill**

`skills/claudian-init/SKILL.md`:

````markdown
---
name: claudian-init
description: First-run setup for Claudian. Creates the Obsidian vault structure, writes the global config at ~/.claudian/config.yaml, and registers projects. Use when no Claudian config exists or when the user wants to reconfigure.
---

# claudian-init

Set up Claudian for the first time or reconfigure an existing installation.

## Setup Flow

### Step 1: Vault Mode
Ask the user:
> "One vault for all projects, or a separate vault per project?"
> - **Single vault** (recommended): All projects share one vault. Cross-project linking and graph view work. Projects are organized in `projects/<name>/` folders.
> - **Per-project vaults**: Each project gets its own isolated vault. No cross-project linking.

### Step 2: Vault Path
Ask where to create the vault. Suggest platform-appropriate defaults:
- Windows: `~/Documents/Claudian-Vault`
- macOS: `~/Documents/Claudian-Vault`
- Linux: `~/claudian-vault`

The user can specify any path.

### Step 3: Register Projects
Offer to register projects:
- Auto-detect known plugins (e.g. Bloxus if installed)
- Ask the user to list project names and repo paths
- Each project needs: name, repo path, tags

### Step 4: Create Vault Structure
Create the vault directory with this structure:
```
<vault-path>/
  .obsidian/
  projects/
  knowledge/
  ideas/
  architecture/
  meta/
    templates/
    claudian-config.yaml
```

Copy the templates from the plugin's `templates/` folder into `meta/templates/`.

### Step 5: Write Global Config
Write `~/.claudian/config.yaml`:
```yaml
version: 1
vaults:
  - name: main
    path: <chosen-path>
    mode: single
    projects:
      <project-name>:
        repo: <repo-path>
        tags: [<tags>]
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

Create the `~/.claudian/` directory if it doesn't exist.

### Step 6: Confirm
Tell the user:
> "Claudian is set up. Your vault is at `<path>`. Open it in Obsidian to see the graph view. Every Claude Code session will now get vault context injected at startup."
````

- [ ] **Step 7: Commit**

```bash
git add skills/
git commit -m "feat: all skills — vault-write, vault-search, vault-extract, vault-link, vault-status, claudian-init"
```

---

### Task 12: Integration Test and Final Wiring

**Files:**
- Create: `tests/integration.test.js`
- Delete: `tests/setup.test.js` (scaffolding placeholder no longer needed)

**Depends on:** All previous tasks.

- [ ] **Step 1: Write integration test**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex, rankNotes } from '../core/relevance.js';
import { parse, generate, validate } from '../core/frontmatter.js';
import { evaluate, WRITE, UPDATE, REJECT } from '../core/quality-gate.js';
import { resolveHome, normalizePath } from '../core/resolver.js';

describe('claudian integration', () => {
  let baseDir;
  let vaultDir;
  let configPath;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `claudian-integration-${Date.now()}`);
    vaultDir = join(baseDir, 'vault');
    configPath = join(baseDir, 'config.yaml');

    await mkdir(join(vaultDir, 'projects', 'my-app'), { recursive: true });
    await mkdir(join(vaultDir, 'knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'ideas'), { recursive: true });
    await mkdir(join(vaultDir, 'architecture'), { recursive: true });

    await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ${vaultDir.replace(/\\/g, '/')}
    mode: single
    projects:
      my-app:
        repo: ${join(baseDir, 'repos', 'my-app').replace(/\\/g, '/')}
        tags: [javascript, web]
capabilities:
  obsidian-cli: auto-detect
`);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('full flow: write a note, index it, find it, quality-gate it', async () => {
    // 1. Generate a note with proper frontmatter
    const frontmatter = {
      title: 'API Rate Limiting',
      type: 'pattern',
      project: 'my-app',
      source: 'claude',
      tags: ['api', 'rate-limiting', 'patterns'],
      created: '2026-04-04',
      updated: '2026-04-04',
      visibility: 'cross-project',
      'relevant-to': [],
      'links-to': [],
    };

    expect(validate(frontmatter)).toEqual([]);

    const noteContent = generate(frontmatter) + '\n\nRate limit all external API calls using a token bucket.\n';
    const notePath = join(vaultDir, 'knowledge', 'api-rate-limiting.md');
    await writeFile(notePath, noteContent);

    // 2. Index the vault and find the note
    const index = await buildIndex(vaultDir);
    expect(index.some(n => n.title === 'API Rate Limiting')).toBe(true);

    // 3. Rank for the my-app project
    const ranked = rankNotes(index, 'my-app', ['api', 'web']);
    expect(ranked[0].title).toBe('API Rate Limiting');

    // 4. Quality gate: writing a duplicate should suggest update
    const result = evaluate(frontmatter, index);
    expect(result.action).toBe(UPDATE);

    // 5. Quality gate: a new note should pass
    const newNote = { ...frontmatter, title: 'WebSocket Connection Pooling' };
    const newResult = evaluate(newNote, index);
    expect(newResult.action).toBe(WRITE);

    // 6. Quality gate: ephemera should be rejected
    const ephemeral = { ...frontmatter, title: 'Debug Session', body: 'We tried fixing the bug but reverted.' };
    const ephResult = evaluate(ephemeral, index);
    expect(ephResult.action).toBe(REJECT);

    // 7. Parse the note back
    const readBack = await readFile(notePath, 'utf-8');
    const parsed = parse(readBack);
    expect(parsed.frontmatter.title).toBe('API Rate Limiting');
    expect(parsed.body).toContain('token bucket');
  });

  it('config loads and detects project from cwd', async () => {
    const config = await loadFrom(configPath);
    const repoDir = join(baseDir, 'repos', 'my-app');
    await mkdir(repoDir, { recursive: true });

    const detected = detectProject(config, normalizePath(repoDir));
    expect(detected.project).toBe('my-app');
    expect(detected.tags).toContain('javascript');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration.test.js`
Expected: All tests pass.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass across all test files.

- [ ] **Step 4: Delete scaffolding placeholder**

Delete `tests/setup.test.js`.

- [ ] **Step 5: Commit**

```bash
git rm tests/setup.test.js
git add tests/integration.test.js
git commit -m "feat: integration test — full write/index/rank/gate flow"
```

---

## Task Dependency Graph

```
Task 1 (scaffolding)
  ├── Task 2 (resolver) ──────────┐
  ├── Task 3 (frontmatter) ───┐   │
  │                            │   │
  │   Task 4 (config) ◄─────────┘───┘
  │   Task 5 (relevance) ◄────┘
  │   Task 6 (quality-gate) ◄─┘
  │
  ├── Task 7 (templates + schema) [independent]
  ├── Task 8 (hook infrastructure) [independent]
  │
  │   Task 9 (session-start hook) ◄── Tasks 4, 5, 8
  │   Task 10 (prompt-submit hook) ◄── Task 8
  │
  ├── Task 11 (skills) [independent — markdown only]
  │
  └── Task 12 (integration test) ◄── all previous tasks
```

**Parallel opportunities:**
- Tasks 2 + 3 can run in parallel
- Tasks 5 + 6 can run in parallel after Task 3
- Tasks 7 + 8 + 11 can run in parallel (no code dependencies)
- Tasks 9 + 10 can run in parallel after Task 8
