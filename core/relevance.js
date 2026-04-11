import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { parse, normalizeTags } from './frontmatter.js';
import { normalizePath } from './resolver.js';

export async function buildIndex(vaultDir) {
  const index = [];
  const warnings = [];
  const outboundLinks = new Map();

  await walkDir(vaultDir, async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const relPath = normalizePath(relative(vaultDir, filePath));
    if (relPath.startsWith('.obsidian/') || relPath.startsWith('meta/templates/')) return;

    try {
      const content = await readFile(filePath, 'utf-8');
      const { frontmatter, body } = parse(content);
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

      const links = new Set();
      const bodyLinks = [...body.matchAll(/\[\[([^\]]+)\]\]/g)]
        .map(m => m[1].split('|')[0].trim());
      bodyLinks.forEach(l => links.add(l));
      const linksTo = frontmatter['links-to'] || [];
      if (Array.isArray(linksTo)) {
        linksTo.filter(l => typeof l === 'string').forEach(l => links.add(l));
      }
      if (links.size > 0) {
        outboundLinks.set(frontmatter.title, [...links]);
      }
    } catch (err) {
      warnings.push({ file: relPath, error: err.message });
    }
  });

  const backlinks = Object.create(null);
  for (const [sourceTitle, targets] of outboundLinks) {
    for (const target of targets) {
      if (!target) continue;
      const key = target.toLowerCase();
      if (!backlinks[key]) backlinks[key] = [];
      backlinks[key].push(sourceTitle);
    }
  }

  return { index, warnings, backlinks };
}

export function rankNotes(index, currentProject, currentTags, gitKeywords = []) {
  return index
    .filter(note => isRelevant(note, currentProject))
    .map(note => ({ ...note, score: scoreNote(note, currentProject, currentTags, gitKeywords) }))
    .sort((a, b) => b.score - a.score);
}

export function isRelevant(note, currentProject) {
  if (note.project === currentProject) return true;
  if (note.project === 'cross-project' || note.visibility === 'cross-project') return true;
  if (note['relevant-to'].includes(currentProject)) return true;
  return false;
}

function scoreNote(note, currentProject, currentTags, gitKeywords = []) {
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

  if (gitKeywords.length > 0) {
    let gitScore = 0;
    const titleWords = note.title.toLowerCase().split(/[\s\-_]+/).filter(w => w.length >= 5);
    for (const keyword of gitKeywords) {
      if (titleWords.includes(keyword) || note.tags.some(t => t.toLowerCase() === keyword)) {
        gitScore += 2;
      }
    }
    score += Math.min(gitScore, 10);
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
