import { describe, it, expect } from 'vitest';
import { matchKeywords } from '../../hooks/user-prompt-submit.runner.js';

describe('user-prompt-submit', () => {
  const index = [
    { title: 'DataStore Locking', tags: ['datastore', 'concurrency'], relPath: 'knowledge/datastore.md' },
    { title: 'Error Handling Pattern', tags: ['errors', 'patterns'], relPath: 'knowledge/errors.md' },
    { title: 'App Architecture', tags: ['architecture', 'game'], relPath: 'projects/my-game/arch.md' },
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
