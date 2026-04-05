import { describe, it, expect } from 'vitest';
import { parse, generate, validate, normalizeTags, VALID_TYPES, VALID_SOURCES } from '../core/frontmatter.js';

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

  describe('normalizeTags', () => {
    it('passes arrays through unchanged', () => {
      expect(normalizeTags(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('splits comma-separated strings into arrays', () => {
      expect(normalizeTags('datastore, sessions')).toEqual(['datastore', 'sessions']);
    });

    it('trims whitespace from split tags', () => {
      expect(normalizeTags('  foo ,  bar , baz  ')).toEqual(['foo', 'bar', 'baz']);
    });

    it('returns empty array for null or undefined', () => {
      expect(normalizeTags(null)).toEqual([]);
      expect(normalizeTags(undefined)).toEqual([]);
    });

    it('returns empty array for non-string non-array values', () => {
      expect(normalizeTags(42)).toEqual([]);
      expect(normalizeTags({})).toEqual([]);
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
