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
      // "App" is 3 chars — ignored. "architecture" title match (2) + tag match (3) = 5
      const score = scoreMatch('Explain the app architecture', note);
      expect(score).toBe(5);
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

    it('returns 0 for empty message', () => {
      const note = {
        title: 'DataStore Locking Pattern',
        tags: ['datastore'],
        relPath: 'knowledge/datastore.md',
      };
      const score = scoreMatch('', note);
      expect(score).toBe(0);
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
      // "plugin" title (2) + "cache" title (2) + "plugin" tag (3) + "cache" tag (3) = 10
      const score = scoreMatch('the plugin cache is stale', note);
      expect(score).toBeGreaterThanOrEqual(4);
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
