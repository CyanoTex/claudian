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

  describe('links-to validation', () => {
    const existingIndex = [
      { title: 'DataStore Session Locking', path: '/vault/knowledge/datastore-locking.md', tags: ['datastore'], project: 'my-project' },
      { title: 'Error Handling Pattern', path: '/vault/knowledge/errors.md', tags: ['errors'], project: 'cross-project' },
    ];

    it('adds warnings for dangling links-to entries', () => {
      const note = { ...validNote, title: 'New Architecture Note', 'links-to': ['DataStore Session Locking', 'Ghost Note'] };
      const result = evaluate(note, existingIndex);
      expect(result.action).toBe(WRITE);
      expect(result.warnings).toContain('links-to references "Ghost Note" which does not exist');
    });

    it('returns no warnings when all links-to entries are valid', () => {
      const note = { ...validNote, title: 'New Architecture Note', 'links-to': ['DataStore Session Locking'] };
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
});
