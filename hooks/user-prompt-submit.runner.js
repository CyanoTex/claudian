import { readFile } from 'fs/promises';
import { cachePointerPath } from '../core/resolver.js';

const MIN_MESSAGE_LENGTH = 20;
const MIN_SCORE = 4;
const MAX_SUGGESTIONS = 3;

function isRelevant(note, currentProject) {
  if (note.project === currentProject) return true;
  if (note.project === 'cross-project' || note.visibility === 'cross-project') return true;
  if (note['relevant-to'] && note['relevant-to'].includes(currentProject)) return true;
  return false;
}

function tokenize(text) {
  const raw = text.toLowerCase().split(/[\s.,;:!?()\[\]"']+/).filter(w => w.length > 0);
  const tokens = new Set();
  for (const token of raw) {
    tokens.add(token);
    if (token.includes('-') || token.includes('_')) {
      for (const part of token.split(/[-_]+/)) {
        if (part.length > 0) tokens.add(part);
      }
    }
  }
  return tokens;
}

export function scoreMatch(message, note) {
  const messageWords = tokenize(message);
  let score = 0;

  const titleWords = note.title.split(/[\s\-_]+/).map(w => w.toLowerCase()).filter(w => w.length >= 5);
  for (const word of titleWords) {
    if (messageWords.has(word)) score += 2;
  }

  for (const tag of note.tags) {
    if (messageWords.has(tag.toLowerCase())) score += 3;
  }

  return score;
}

async function run() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    emptyOutput();
    return;
  }

  let userMessage;
  try {
    const parsed = JSON.parse(input);
    userMessage = parsed.message || parsed.prompt || input;
  } catch {
    userMessage = input;
  }

  if (userMessage.length < MIN_MESSAGE_LENGTH) {
    emptyOutput();
    return;
  }

  const pointerPath = cachePointerPath();
  let index;
  try {
    const cachePath = (await readFile(pointerPath, 'utf-8')).trim();
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    const project = cached.project || null;
    const fullIndex = 'index' in cached ? cached.index : cached;
    index = fullIndex.filter(note => isRelevant(note, project));
  } catch {
    emptyOutput();
    return;
  }

  const scored = index
    .map(note => ({ note, score: scoreMatch(userMessage, note) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);

  if (scored.length === 0) {
    emptyOutput();
    return;
  }

  const noteList = scored.map(({ note }) => `[[${note.title}]] (${note.relPath})`).join(', ');
  const context = `[Claudian] Vault may have relevant notes: ${noteList}. Consider vault-search.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  }));
}

function emptyOutput() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: '',
    },
  }));
}

import { pathToFileURL } from 'url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch(() => emptyOutput());
}
