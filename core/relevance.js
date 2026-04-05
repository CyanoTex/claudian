import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { parse, normalizeTags } from './frontmatter.js';
import { normalizePath } from './resolver.js';

export async function buildIndex(vaultDir) {
  const index = [];
  const warnings = [];
  await walkDir(vaultDir, async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const relPath = normalizePath(relative(vaultDir, filePath));
    if (relPath.startsWith('.obsidian/') || relPath.startsWith('meta/templates/')) return;

    try {
      const content = await readFile(filePath, 'utf-8');
      const { frontmatter } = parse(content);
      if (!frontmatter || !frontmatter.title) return;

      index.push({
        title: frontmatter.title,
        path: normalizePath(filePath),
        relPath,
        type: frontmatter.type,
        project: frontmatter.project,
        source: frontmatter.source,
        tags: normalizeTags(frontmatter.tags),
        visibility: frontmatter.visibility || 'project-only',
        'relevant-to': frontmatter['relevant-to'] || [],
        updated: frontmatter.updated || frontmatter.created,
      });
    } catch (err) {
      warnings.push({ file: relPath, error: err.message });
    }
  });
  return { index, warnings };
}

export function rankNotes(index, currentProject, currentTags) {
  return index
    .filter(note => isRelevant(note, currentProject))
    .map(note => ({ ...note, score: scoreNote(note, currentProject, currentTags) }))
    .sort((a, b) => b.score - a.score);
}

function isRelevant(note, currentProject) {
  if (note.project === currentProject) return true;
  if (note.project === 'cross-project' || note.visibility === 'cross-project') return true;
  if (note['relevant-to'].includes(currentProject)) return true;
  return false;
}

function scoreNote(note, currentProject, currentTags) {
  let score = 0;

  if (note.project === currentProject) score += 10;
  if (note['relevant-to'].includes(currentProject)) score += 5;
  if (note.visibility === 'cross-project') score += 2;

  const tagOverlap = note.tags.filter(t => currentTags.includes(t)).length;
  score += tagOverlap * 3;

  if (note.updated) {
    const daysAgo = (Date.now() - new Date(note.updated).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - daysAgo / 30);
  }

  return score;
}

async function walkDir(dir, callback) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      await walkDir(fullPath, callback);
    } else {
      await callback(fullPath);
    }
  }
}
