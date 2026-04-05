import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildIndex, rankNotes, isRelevant } from '../core/relevance.js';

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

      const { index } = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].title).toBe('Test Pattern');
      expect(index[0].tags).toContain('testing');
      expect(index[0].path).toContain('test-note.md');
    });

    it('skips files without frontmatter', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'plain.md'), 'No frontmatter here.');
      const { index } = await buildIndex(vaultDir);
      expect(index).toHaveLength(0);
    });

    it('normalizes inline comma-separated tags to array', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'inline-tags.md'), `---
title: Inline Tags Note
type: knowledge
project: cross-project
source: human
tags: datastore, sessions
created: '2026-04-04'
updated: '2026-04-04'
---

Content.`);

      const { index } = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].tags).toEqual(['datastore', 'sessions']);
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

      const { index } = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].project).toBe('my-app');
    });

    it('skips malformed notes and continues indexing', async () => {
      await writeFile(join(vaultDir, 'knowledge', 'good-note.md'), `---
title: Good Note
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

Valid note.`);

      await writeFile(join(vaultDir, 'knowledge', 'bad-note.md'), `---
title: [invalid yaml
  this is broken: {{{
---

Bad frontmatter.`);

      const { index, warnings } = await buildIndex(vaultDir);
      expect(index).toHaveLength(1);
      expect(index[0].title).toBe('Good Note');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].file).toContain('bad-note.md');
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

  describe('isRelevant', () => {
    it('returns true for notes matching the current project', () => {
      const note = { project: 'my-app', visibility: 'project-only', 'relevant-to': [] };
      expect(isRelevant(note, 'my-app')).toBe(true);
    });

    it('returns true for cross-project notes', () => {
      const note = { project: 'cross-project', visibility: 'cross-project', 'relevant-to': [] };
      expect(isRelevant(note, 'any-project')).toBe(true);
    });

    it('returns true for notes with cross-project visibility', () => {
      const note = { project: 'some-project', visibility: 'cross-project', 'relevant-to': [] };
      expect(isRelevant(note, 'other-project')).toBe(true);
    });

    it('returns true for notes listed in relevant-to', () => {
      const note = { project: 'other-project', visibility: 'project-only', 'relevant-to': ['my-app'] };
      expect(isRelevant(note, 'my-app')).toBe(true);
    });

    it('returns false for project-only notes from other projects', () => {
      const note = { project: 'other-project', visibility: 'project-only', 'relevant-to': [] };
      expect(isRelevant(note, 'my-app')).toBe(false);
    });

    it('returns false when relevant-to does not include current project', () => {
      const note = { project: 'other-project', visibility: 'project-only', 'relevant-to': ['third-project'] };
      expect(isRelevant(note, 'my-app')).toBe(false);
    });

    it('returns false for project-only notes when project is null', () => {
      const note = { project: 'my-app', visibility: 'project-only', 'relevant-to': [] };
      expect(isRelevant(note, null)).toBe(false);
    });
  });
});
