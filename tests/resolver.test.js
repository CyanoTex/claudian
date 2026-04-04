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
