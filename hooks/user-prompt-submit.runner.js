import { readFile } from 'fs/promises';
import { cachePointerPath } from '../core/resolver.js';
import { isRelevant } from '../core/relevance.js';

export function matchKeywords(message, index) {
  const messageLower = message.toLowerCase();
  const matched = new Map();

  for (const note of index) {
    const titleWords = note.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const titleMatch = titleWords.some(word => messageLower.includes(word));
    const tagMatch = note.tags.some(tag => messageLower.includes(tag.toLowerCase()));

    if (titleMatch || tagMatch) {
      matched.set(note.relPath, note);
    }
  }

  return Array.from(matched.values());
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

  // Read the active cache pointer written by SessionStart
  const pointerPath = cachePointerPath();
  let index;
  try {
    const cachePath = (await readFile(pointerPath, 'utf-8')).trim();
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    const project = cached.project || null;
    const fullIndex = cached.index || cached;
    index = fullIndex.filter(note => isRelevant(note, project));
  } catch {
    emptyOutput();
    return;
  }

  const matches = matchKeywords(userMessage, index);

  if (matches.length === 0) {
    emptyOutput();
    return;
  }

  const noteList = matches.slice(0, 5).map(n => `[[${n.title}]] (${n.relPath})`).join(', ');
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

// Only run as main module
import { pathToFileURL } from 'url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch(() => emptyOutput());
}
