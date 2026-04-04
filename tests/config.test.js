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
