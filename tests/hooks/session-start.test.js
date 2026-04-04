import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

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
});
