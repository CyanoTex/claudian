import { describe, it, expect } from 'vitest';
import { matchKeywords } from '../../hooks/user-prompt-submit.runner.js';
import { isRelevant } from '../../core/relevance.js';

describe('user-prompt-submit', () => {
  const index = [
    { title: 'DataStore Locking', tags: ['datastore', 'concurrency'], relPath: 'knowledge/datastore.md', project: 'my-game', visibility: 'project-only', 'relevant-to': [] },
    { title: 'Error Handling Pattern', tags: ['errors', 'patterns'], relPath: 'knowledge/errors.md', project: 'cross-project', visibility: 'cross-project', 'relevant-to': [] },
    { title: 'App Architecture', tags: ['architecture', 'game'], relPath: 'projects/my-game/arch.md', project: 'my-game', visibility: 'project-only', 'relevant-to': [] },
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

  describe('visibility filtering', () => {
    const mixedIndex = [
      { title: 'DataStore Locking', tags: ['datastore'], relPath: 'knowledge/datastore.md', project: 'my-game', visibility: 'project-only', 'relevant-to': [] },
      { title: 'Shared Pattern', tags: ['datastore'], relPath: 'knowledge/shared.md', project: 'cross-project', visibility: 'cross-project', 'relevant-to': [] },
      { title: 'Other Game DataStore', tags: ['datastore'], relPath: 'projects/other-game/ds.md', project: 'other-game', visibility: 'project-only', 'relevant-to': [] },
      { title: 'Linked DataStore Note', tags: ['datastore'], relPath: 'knowledge/linked.md', project: 'other-game', visibility: 'project-only', 'relevant-to': ['my-game'] },
    ];

    it('filters out project-only notes from other projects', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, 'my-game'));
      const matches = matchKeywords('datastore', filtered);
      const titles = matches.map(m => m.title);
      expect(titles).toContain('DataStore Locking');
      expect(titles).toContain('Shared Pattern');
      expect(titles).toContain('Linked DataStore Note');
      expect(titles).not.toContain('Other Game DataStore');
    });

    it('allows cross-project notes through for any project', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, 'unrelated-project'));
      const matches = matchKeywords('datastore', filtered);
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe('Shared Pattern');
    });

    it('excludes all project-only notes when project is null', () => {
      const filtered = mixedIndex.filter(note => isRelevant(note, null));
      expect(filtered.every(n => n.visibility === 'cross-project' || n.project === 'cross-project')).toBe(true);
      expect(filtered.some(n => n.project === 'other-game' && n['relevant-to'].length === 0)).toBe(false);
    });
  });
});
