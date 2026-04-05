import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex, rankNotes } from '../core/relevance.js';
import { resolveHome, cachePointerPath } from '../core/resolver.js';

export function indexCachePath(vaultPath) {
  const hash = createHash('md5').update(vaultPath).digest('hex').slice(0, 12);
  return join(tmpdir(), 'claudian', `index-cache-${hash}.json`);
}

const configPath = process.argv[2] || resolveHome('~/.claudian/config.yaml');

async function run() {
  let config;
  try {
    config = await loadFrom(configPath);
  } catch (err) {
    output(`[Claudian] Config not found at ${configPath}. Run /claudian-init to set up.`);
    return;
  }

  const cwd = process.cwd();
  const { vault, project, tags } = detectProject(config, cwd);
  const vaultPath = resolveHome(vault.path);

  let index, warnings;
  try {
    ({ index, warnings } = await buildIndex(vaultPath));
  } catch (err) {
    output(`[Claudian] Could not read vault at ${vaultPath}: ${err.message}`);
    return;
  }

  // Cache index for UserPromptSubmit hook (avoids rebuilding on every prompt)
  const cachePath = indexCachePath(vaultPath);
  const pointerPath = cachePointerPath();
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(index));
    await writeFile(pointerPath, cachePath);
  } catch {
    // Non-fatal: prompt-submit will just skip matching
  }

  const relevant = rankNotes(index, project, tags || []).slice(0, 20);

  const lines = [
    `# Claudian Vault Context`,
    ``,
    `**Vault:** ${vault.name} (${vaultPath})`,
    `**Project:** ${project || 'unregistered'}`,
    `**Notes indexed:** ${index.length}`,
    ``,
  ];

  if (relevant.length > 0) {
    lines.push(`## Relevant Notes`);
    lines.push(``);
    lines.push(`| Title | Type | Tags | Path |`);
    lines.push(`|---|---|---|---|`);
    for (const note of relevant) {
      lines.push(`| ${note.title} | ${note.type} | ${note.tags.join(', ')} | ${note.relPath} |`);
    }
    lines.push(``);
    lines.push(`Use vault-search to find more notes or read a specific note by path.`);
  } else {
    lines.push(`No relevant notes found. Use vault-write to start building knowledge.`);
  }

  if (warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push(``);
    for (const w of warnings) {
      lines.push(`- **${w.file}**: ${w.error}`);
    }
    lines.push(``);
  }

  output(lines.join('\n'));
}

function output(text) {
  const result = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: text,
    },
  };
  process.stdout.write(JSON.stringify(result));
}

run().catch(err => {
  output(`[Claudian] Error: ${err.message}`);
});
