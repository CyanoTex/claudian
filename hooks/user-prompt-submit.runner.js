import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadFrom, detectProject } from '../core/config.js';
import { resolveHome } from '../core/resolver.js';

function indexCachePath(vaultPath) {
  const hash = createHash('md5').update(vaultPath).digest('hex').slice(0, 12);
  return join(tmpdir(), 'claudian', `index-cache-${hash}.json`);
}

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

  // Resolve vault path to find the correct cache file
  let cachePath;
  try {
    const config = await loadFrom(resolveHome('~/.claudian/config.yaml'));
    const { vault } = detectProject(config, process.cwd());
    cachePath = indexCachePath(resolveHome(vault.path));
  } catch {
    emptyOutput();
    return;
  }

  // Read cached index from SessionStart (no filesystem scan on every prompt)
  let index;
  try {
    const cached = await readFile(cachePath, 'utf-8');
    index = JSON.parse(cached);
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
