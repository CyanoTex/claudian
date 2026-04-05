import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { cachePointerPath } from '../../core/resolver.js';

const exec = promisify(execFile);

describe('session-start hook', () => {
  let baseDir, vaultDir, configPath;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `claudian-hook-test-${Date.now()}`);
    vaultDir = join(baseDir, 'vault');
    configPath = join(baseDir, 'config.yaml');

    await mkdir(join(vaultDir, 'knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'ideas'), { recursive: true });

    await writeFile(join(vaultDir, 'knowledge', 'test-note.md'), `---
title: Test Pattern
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

A test pattern note.`);

    await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ${vaultDir.replace(/\\/g, '/')}
    mode: single
    projects: {}
capabilities:
  obsidian-cli: auto-detect
`);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
    // Clean up session-scoped pointer and cache files written by the hook runner
    const pointerPath = cachePointerPath();
    try {
      const cachePath = (await readFile(pointerPath, 'utf-8')).trim();
      await rm(cachePath, { force: true });
      await rm(pointerPath, { force: true });
    } catch {
      // Pointer may not exist if test didn't reach that point
    }
  });

  it('outputs valid JSON with vault context', async () => {
    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.additionalContext).toContain('Claudian');
  });

  it('includes relevant notes in output', async () => {
    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, configPath]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('Test Pattern');
  });

  it('handles missing config gracefully', async () => {
    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const { stdout } = await exec('node', [runnerPath, join(baseDir, 'nonexistent.yaml')]);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('Config not found');
  });

  it('writes session-scoped pointer files for different sessions', async () => {
    const runnerPath = join(process.cwd(), 'hooks', 'session-start.runner.js');
    const env1 = { ...process.env, CLAUDE_SESSION_ID: 'session-aaa' };
    const env2 = { ...process.env, CLAUDE_SESSION_ID: 'session-bbb' };

    await exec('node', [runnerPath, configPath], { env: env1 });
    await exec('node', [runnerPath, configPath], { env: env2 });

    const pointer1 = join(tmpdir(), 'claudian', 'active-cache-session-aaa.txt');
    const pointer2 = join(tmpdir(), 'claudian', 'active-cache-session-bbb.txt');

    const cache1 = (await readFile(pointer1, 'utf-8')).trim();
    const cache2 = (await readFile(pointer2, 'utf-8')).trim();

    expect(cache1).toBeTruthy();
    expect(cache2).toBeTruthy();
    expect(pointer1).not.toBe(pointer2);

    await rm(pointer1, { force: true });
    await rm(pointer2, { force: true });
    await rm(cache1, { force: true });
    await rm(cache2, { force: true });
  });
});
