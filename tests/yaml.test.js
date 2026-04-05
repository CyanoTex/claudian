import { describe, it, expect } from 'vitest';
import { load, dump } from '../core/yaml.js';

describe('yaml', () => {
  describe('load', () => {
    it('returns null for empty/null input', () => {
      expect(load('')).toBeNull();
      expect(load(null)).toBeNull();
      expect(load(undefined)).toBeNull();
      expect(load('   \n\n  ')).toBeNull();
    });

    it('parses simple key-value pairs', () => {
      const result = load('title: Test Note\ntype: knowledge');
      expect(result).toEqual({ title: 'Test Note', type: 'knowledge' });
    });

    it('parses quoted strings', () => {
      const result = load(`title: "Hello World"\nname: 'Single'`);
      expect(result.title).toBe('Hello World');
      expect(result.name).toBe('Single');
    });

    it('parses numbers', () => {
      const result = load('version: 1\ncount: -5\nrate: 3.14');
      expect(result.version).toBe(1);
      expect(result.count).toBe(-5);
      expect(result.rate).toBe(3.14);
    });

    it('parses booleans and null', () => {
      const result = load('enabled: true\ndisabled: false\nempty: null\ntilde: ~');
      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
      expect(result.empty).toBeNull();
      expect(result.tilde).toBeNull();
    });

    it('parses inline arrays', () => {
      const result = load('tags: [javascript, web]\nempty: []');
      expect(result.tags).toEqual(['javascript', 'web']);
      expect(result.empty).toEqual([]);
    });

    it('parses inline arrays with quoted items', () => {
      const result = load(`items: ["hello, world", 'foo']`);
      expect(result.items).toEqual(['hello, world', 'foo']);
    });

    it('parses nested mappings', () => {
      const yaml = `
capabilities:
  obsidian-cli: auto-detect
  claude-mem: disabled`;
      const result = load(yaml);
      expect(result.capabilities['obsidian-cli']).toBe('auto-detect');
      expect(result.capabilities['claude-mem']).toBe('disabled');
    });

    it('parses inline empty objects', () => {
      const result = load('projects: {}');
      expect(result.projects).toEqual({});
    });

    it('parses inline objects with entries', () => {
      const result = load('meta: {key: value, num: 42}');
      expect(result.meta).toEqual({ key: 'value', num: 42 });
    });

    it('throws on unterminated inline array', () => {
      expect(() => load('title: [invalid yaml')).toThrow('Unterminated inline array');
    });

    it('throws on unterminated inline object', () => {
      expect(() => load('data: {broken')).toThrow('Unterminated inline object');
    });

    it('parses block sequences', () => {
      const yaml = `
items:
  - alpha
  - beta
  - gamma`;
      const result = load(yaml);
      expect(result.items).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('parses block sequences of mappings', () => {
      const yaml = `
vaults:
  - name: main
    path: ~/vault
    mode: single`;
      const result = load(yaml);
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].name).toBe('main');
      expect(result.vaults[0].path).toBe('~/vault');
      expect(result.vaults[0].mode).toBe('single');
    });

    it('parses the full config shape', () => {
      const yaml = `
version: 1
vaults:
  - name: main
    path: ~/Documents/Vault
    mode: single
    projects:
      my-app:
        repo: ~/src/my-app
        tags: [javascript, web]
capabilities:
  obsidian-cli: auto-detect`;
      const result = load(yaml);
      expect(result.version).toBe(1);
      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0].name).toBe('main');
      expect(result.vaults[0].projects['my-app'].repo).toBe('~/src/my-app');
      expect(result.vaults[0].projects['my-app'].tags).toEqual(['javascript', 'web']);
      expect(result.capabilities['obsidian-cli']).toBe('auto-detect');
    });

    it('parses frontmatter shape', () => {
      const yaml = `
title: Test Note
type: knowledge
project: my-project
source: claude
tags: [test, example]
created: "2026-04-04"
updated: "2026-04-04"
visibility: project-only
relevant-to: []
links-to: []`;
      const result = load(yaml);
      expect(result.title).toBe('Test Note');
      expect(result.type).toBe('knowledge');
      expect(result.tags).toEqual(['test', 'example']);
      expect(result.created).toBe('2026-04-04');
      expect(result['links-to']).toEqual([]);
    });

    it('skips comment-only lines', () => {
      const yaml = `# top comment\ntitle: Test\n# mid comment\ntype: knowledge`;
      const result = load(yaml);
      expect(result).toEqual({ title: 'Test', type: 'knowledge' });
    });

    it('strips inline comments', () => {
      const result = load('title: Test # this is a comment');
      expect(result.title).toBe('Test');
    });

    it('preserves # inside quoted strings', () => {
      const result = load(`title: "has # hash"`);
      expect(result.title).toBe('has # hash');
    });

    it('handles blank lines between entries', () => {
      const yaml = `title: A\n\ntype: B\n\ntags: [c]`;
      const result = load(yaml);
      expect(result).toEqual({ title: 'A', type: 'B', tags: ['c'] });
    });

    it('handles Windows paths with colons', () => {
      const result = load('path: C:\\src\\project');
      expect(result.path).toBe('C:\\src\\project');
    });

    it('handles URLs as values', () => {
      const result = load('url: https://example.com/path');
      expect(result.url).toBe('https://example.com/path');
    });

    it('handles key with null block value', () => {
      const yaml = 'empty-key:\nnext: value';
      const result = load(yaml);
      expect(result['empty-key']).toBeNull();
      expect(result.next).toBe('value');
    });

    it('parses multiple projects in config', () => {
      const yaml = `
vaults:
  - name: main
    projects:
      app-a:
        repo: /src/a
        tags: [web]
      app-b:
        repo: /src/b
        tags: [api]`;
      const result = load(yaml);
      const projects = result.vaults[0].projects;
      expect(projects['app-a'].repo).toBe('/src/a');
      expect(projects['app-b'].repo).toBe('/src/b');
      expect(projects['app-b'].tags).toEqual(['api']);
    });
  });

  describe('dump', () => {
    it('dumps simple key-value pairs', () => {
      const result = dump({ title: 'Test', type: 'knowledge' });
      expect(result).toContain('title: Test');
      expect(result).toContain('type: knowledge');
      expect(result.endsWith('\n')).toBe(true);
    });

    it('sorts keys when requested', () => {
      const result = dump({ z: 1, a: 2 }, { sortKeys: true });
      const lines = result.trim().split('\n');
      expect(lines[0]).toBe('a: 2');
      expect(lines[1]).toBe('z: 1');
    });

    it('dumps inline arrays', () => {
      const result = dump({ tags: ['web', 'api'] });
      expect(result).toContain('tags: [web, api]');
    });

    it('dumps empty arrays', () => {
      const result = dump({ items: [] });
      expect(result).toContain('items: []');
    });

    it('quotes date-like strings', () => {
      const result = dump({ created: '2026-04-04' });
      expect(result).toContain("created: '2026-04-04'");
    });

    it('quotes YAML keywords', () => {
      const result = dump({ val: 'true', other: 'null' });
      expect(result).toContain("val: 'true'");
      expect(result).toContain("other: 'null'");
    });

    it('quotes empty strings', () => {
      const result = dump({ name: '' });
      expect(result).toContain("name: ''");
    });

    it('quotes strings that look like numbers', () => {
      const result = dump({ port: '8080' });
      expect(result).toContain("port: '8080'");
    });

    it('does not quote plain strings', () => {
      const result = dump({ title: 'Test Note', mode: 'single' });
      expect(result).toContain('title: Test Note');
      expect(result).toContain('mode: single');
    });

    it('dumps null values', () => {
      const result = dump({ key: null });
      expect(result).toContain('key: null');
    });

    it('dumps booleans', () => {
      const result = dump({ a: true, b: false });
      expect(result).toContain('a: true');
      expect(result).toContain('b: false');
    });

    it('dumps numbers', () => {
      const result = dump({ version: 1 });
      expect(result).toContain('version: 1');
    });

    it('dumps nested objects', () => {
      const result = dump({ outer: { inner: 'value' } });
      expect(result).toContain('outer:\n  inner: value');
    });

    it('quotes flow items with commas', () => {
      const result = dump({ items: ['a, b', 'c'] });
      expect(result).toContain("'a, b'");
      expect(result).toContain('c');
    });
  });

  describe('round-trip', () => {
    it('round-trips frontmatter', () => {
      const original = {
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

      const yaml = dump(original, { sortKeys: true });
      const parsed = load(yaml);

      expect(parsed.title).toBe(original.title);
      expect(parsed.type).toBe(original.type);
      expect(parsed.project).toBe(original.project);
      expect(parsed.source).toBe(original.source);
      expect(parsed.tags).toEqual(original.tags);
      expect(parsed.created).toBe(original.created);
      expect(parsed.updated).toBe(original.updated);
      expect(parsed.visibility).toBe(original.visibility);
      expect(parsed['relevant-to']).toEqual(original['relevant-to']);
      expect(parsed['links-to']).toEqual(original['links-to']);
    });

    it('round-trips through generate/parse pattern', () => {
      const fm = { title: 'Test', type: 'knowledge' };
      const yamlStr = dump(fm, { lineWidth: -1, sortKeys: true }).trim();
      const full = `---\n${yamlStr}\n---\n\nBody content.`;

      const match = full.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      const parsed = load(match[1]);
      expect(parsed.title).toBe('Test');
      expect(parsed.type).toBe('knowledge');
      expect(match[2].trim()).toBe('Body content.');
    });
  });
});
