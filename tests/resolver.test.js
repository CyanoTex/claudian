import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHome, platformDefault, normalizePath, cachePointerPath } from '../core/resolver.js';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

describe('resolver', () => {
  describe('resolveHome', () => {
    it('expands ~ to home directory with normalized slashes', () => {
      const home = normalizePath(homedir());
      expect(resolveHome('~/Documents/vault')).toBe(`${home}/Documents/vault`);
    });

    it('expands bare ~ to home directory with normalized slashes', () => {
      const home = normalizePath(homedir());
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

  describe('cachePointerPath', () => {
    const origEnv = process.env.CLAUDE_SESSION_ID;

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = origEnv;
      }
    });

    it('defaults to active-cache-default.txt when no session ID set', () => {
      delete process.env.CLAUDE_SESSION_ID;
      const result = cachePointerPath();
      expect(result).toBe(join(tmpdir(), 'claudian', 'active-cache-default.txt'));
    });

    it('includes session ID in filename when CLAUDE_SESSION_ID is set', () => {
      process.env.CLAUDE_SESSION_ID = 'abc-123';
      const result = cachePointerPath();
      expect(result).toBe(join(tmpdir(), 'claudian', 'active-cache-abc-123.txt'));
    });

    it('produces different paths for different session IDs', () => {
      process.env.CLAUDE_SESSION_ID = 'session-A';
      const pathA = cachePointerPath();
      process.env.CLAUDE_SESSION_ID = 'session-B';
      const pathB = cachePointerPath();
      expect(pathA).not.toBe(pathB);
    });
  });
});
