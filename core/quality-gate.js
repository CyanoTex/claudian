import { validateLinksTo } from './frontmatter.js';

export const WRITE = 'write';
export const UPDATE = 'update';
export const REJECT = 'reject';

const EPHEMERA_PATTERNS = [
  /\b(tried|reverted|broke|debugging|fixed the bug)\b/i,
  /\b(user prefers|user wants|user likes)\b/i,
  /\b(today we|this session|just now|earlier today)\b/i,
  /\b(attempting to|trying to fix|reverting)\b/i,
];

export function evaluate(note, existingIndex, { plannedLinks = [] } = {}) {
  const validationError = validateBasics(note);
  if (validationError) return { action: REJECT, reason: validationError, warnings: [] };

  if (isEphemera(note)) {
    return { action: REJECT, reason: 'Content appears to be session ephemera, not durable knowledge.', warnings: [] };
  }

  const duplicate = findDuplicate(note, existingIndex);
  if (duplicate) {
    return { action: UPDATE, reason: `Similar note exists: "${duplicate.title}"`, existingPath: duplicate.path, warnings: [] };
  }

  const warnings = [];
  const { dangling } = validateLinksTo(note['links-to'], existingIndex, plannedLinks);
  for (const title of dangling) {
    warnings.push(`links-to references "${title}" which does not exist`);
  }

  return { action: WRITE, reason: 'Passes quality gate.', warnings };
}

function validateBasics(note) {
  if (!note.title || note.title.trim() === '') return 'Note must have a title.';
  if (!note.tags || note.tags.length === 0) return 'Note must have at least one tag.';
  return null;
}

function isEphemera(note) {
  const text = `${note.title} ${note.body || ''}`;
  return EPHEMERA_PATTERNS.some(pattern => pattern.test(text));
}

function findDuplicate(note, existingIndex) {
  const normalTitle = note.title.toLowerCase().trim();
  return existingIndex.find(existing =>
    existing.title.toLowerCase().trim() === normalTitle
  ) || null;
}
