import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex, rankNotes } from '../core/relevance.js';
import { parse, generate, validate } from '../core/frontmatter.js';
import { evaluate, WRITE, UPDATE, REJECT } from '../core/quality-gate.js';
import { resolveHome, normalizePath } from '../core/resolver.js';

describe('claudian integration', () => {
  let baseDir, vaultDir, configPath;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `claudian-integration-${Date.now()}`);
    vaultDir = join(baseDir, 'vault');
    configPath = join(baseDir, 'config.yaml');

    await mkdir(join(vaultDir, 'projects', 'my-app'), { recursive: true });
    await mkdir(join(vaultDir, 'knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'ideas'), { recursive: true });
    await mkdir(join(vaultDir, 'architecture'), { recursive: true });

    await writeFile(configPath, `
version: 1
vaults:
  - name: main
    path: ${vaultDir.replace(/\\/g, '/')}
    mode: single
    projects:
      my-app:
        repo: ${join(baseDir, 'repos', 'my-app').replace(/\\/g, '/')}
        tags: [javascript, web]
capabilities:
  obsidian-cli: auto-detect
`);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('full flow: write a note, index it, find it, quality-gate it', async () => {
    // 1. Generate a note with proper frontmatter
    const frontmatter = {
      title: 'API Rate Limiting',
      type: 'pattern',
      project: 'my-app',
      source: 'claude',
      tags: ['api', 'rate-limiting', 'patterns'],
      created: '2026-04-04',
      updated: '2026-04-04',
      visibility: 'cross-project',
      'relevant-to': [],
      'links-to': [],
    };

    expect(validate(frontmatter)).toEqual([]);

    const noteContent = generate(frontmatter) + '\n\nRate limit all external API calls using a token bucket.\n';
    const notePath = join(vaultDir, 'knowledge', 'api-rate-limiting.md');
    await writeFile(notePath, noteContent);

    // 2. Index the vault and find the note
    const { index } = await buildIndex(vaultDir);
    expect(index.some(n => n.title === 'API Rate Limiting')).toBe(true);

    // 3. Rank for the my-app project
    const ranked = rankNotes(index, 'my-app', ['api', 'web']);
    expect(ranked[0].title).toBe('API Rate Limiting');

    // 4. Quality gate: writing a duplicate should suggest update
    const result = evaluate(frontmatter, index);
    expect(result.action).toBe(UPDATE);

    // 5. Quality gate: a new note should pass
    const newNote = { ...frontmatter, title: 'WebSocket Connection Pooling' };
    const newResult = evaluate(newNote, index);
    expect(newResult.action).toBe(WRITE);

    // 6. Quality gate: ephemera should be rejected
    const ephemeral = { ...frontmatter, title: 'Debug Attempt', body: 'We tried fixing the bug but reverted.' };
    const ephResult = evaluate(ephemeral, index);
    expect(ephResult.action).toBe(REJECT);

    // 7. Parse the note back
    const readBack = await readFile(notePath, 'utf-8');
    const parsed = parse(readBack);
    expect(parsed.frontmatter.title).toBe('API Rate Limiting');
    expect(parsed.body).toContain('token bucket');
  });

  it('config loads and detects project from cwd', async () => {
    const config = await loadFrom(configPath);
    const repoDir = join(baseDir, 'repos', 'my-app');
    await mkdir(repoDir, { recursive: true });

    const detected = detectProject(config, normalizePath(repoDir));
    expect(detected.project).toBe('my-app');
    expect(detected.tags).toContain('javascript');
  });
});
