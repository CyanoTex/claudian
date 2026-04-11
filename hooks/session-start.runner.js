import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { loadFrom, detectProject } from '../core/config.js';
import { buildIndex, rankNotes } from '../core/relevance.js';
import { resolveHome, cachePointerPath } from '../core/resolver.js';

export function indexCachePath(vaultPath) {
  const hash = createHash('md5').update(vaultPath).digest('hex').slice(0, 12);
  return join(tmpdir(), 'claudian', `index-cache-${hash}.json`);
}

const configPath = process.argv[2] || resolveHome('~/.claudian/config.yaml');

function extractGitKeywords(cwd) {
  try {
    const keywords = new Set();
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    if (!branch) return [];
    branch.split(/[/\-_]+/).filter(w => w.length >= 5).forEach(w => keywords.add(w.toLowerCase()));
    const log = execFileSync('git', ['log', '-5', '--format=%s'], { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    log.split(/[\s\-_.,;:!?()\[\]"'`#@/{}]+/).filter(w => w.length >= 5).forEach(w => keywords.add(w.toLowerCase()));
    return [...keywords];
  } catch (_err) {
    return [];
  }
}

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

  let index, warnings, backlinks;
  try {
    ({ index, warnings, backlinks } = await buildIndex(vaultPath));
  } catch (err) {
    output(`[Claudian] Could not read vault at ${vaultPath}: ${err.message}`);
    return;
  }

  // Cache index + backlinks for downstream hooks and consumers
  const cachePath = indexCachePath(vaultPath);
  const pointerPath = cachePointerPath();
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ project, index, backlinks }));
    await writeFile(pointerPath, cachePath);
  } catch {
    // Non-fatal: prompt-submit will just skip matching
  }

  const gitKeywords = extractGitKeywords(cwd);
  const relevant = rankNotes(index, project, tags || [], gitKeywords).slice(0, 20);

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
    lines.push(`Read a specific note by path, or search the vault with Grep/Glob.`);
  } else {
    lines.push(`No relevant notes found. Use vault-write to start building knowledge.`);
  }

  // Detect planned links in project index
  if (project) {
    try {
      const indexPath = join(vaultPath, 'projects', project, 'index.md');
      const indexContent = await readFile(indexPath, 'utf-8');
      const body = indexContent
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')  // strip frontmatter
        .replace(/```[\s\S]*?```/g, '');                   // strip code blocks
      const wikilinks = [...body.matchAll(/\[\[([^\]]+)\]\]/g)]
        .map(m => m[1].split('|')[0].trim());              // handle [[target|alias]]
      const titles = new Set(index.map(n => n.title.toLowerCase()));
      const planned = wikilinks.filter(w => !titles.has(w.toLowerCase()));
      if (planned.length > 0) {
        lines.push(`## Planned Notes`);
        lines.push(``);
        lines.push(`Project index has ${planned.length} planned note(s) not yet created. Run /vault-stub to resolve.`);
        lines.push(``);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        warnings.push({ file: `projects/${project}/index.md`, error: err.message });
      }
    }
  }

  // Seed manifest detection
  if (project) {
    try {
      const manifestPath = join(vaultPath, 'projects', project, 'seed-manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      const unfinished = (manifest.notes || []).filter(n => n.status === 'pending' || n.status === 'deferred');
      if (unfinished.length > 0) {
        lines.push(`## Seed Progress`);
        lines.push(``);
        lines.push(`vault-seed has ${unfinished.length} unfinished note(s) for ${project}. Run /vault-seed to resume.`);
        lines.push(``);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        warnings.push({ file: `projects/${project}/seed-manifest.json`, error: err.message });
      }
    }
  }

  // Gardener staleness check
  try {
    const gardenerTimePath = join(vaultPath, '.claudian', 'gardener-last-run');
    const lastRun = (await readFile(gardenerTimePath, 'utf-8')).trim();
    const lastRunDate = new Date(lastRun);
    if (isNaN(lastRunDate.getTime())) {
      warnings.push({ file: '.claudian/gardener-last-run', error: `Invalid date: "${lastRun}"` });
    } else {
      const daysAgo = Math.floor((Date.now() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 7) {
        lines.push(`## Maintenance`);
        lines.push(``);
        lines.push(`Vault maintenance hasn't run in ${daysAgo} days. Consider running /vault-gardener.`);
        lines.push(``);
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      lines.push(`## Maintenance`);
      lines.push(``);
      lines.push(`Vault maintenance has never run. Consider running /vault-gardener.`);
      lines.push(``);
    } else {
      warnings.push({ file: '.claudian/gardener-last-run', error: err?.message || err });
    }
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
