import yaml from './yaml.js';

export const VALID_TYPES = ['knowledge', 'architecture', 'idea', 'spec', 'pattern', 'gotcha'];
export const VALID_SOURCES = ['claude', 'human', 'extracted'];
export const VALID_VISIBILITY = ['project-only', 'cross-project'];
const REQUIRED_FIELDS = ['title', 'type', 'project', 'source', 'tags', 'created', 'updated'];

export function parse(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  return {
    frontmatter: yaml.load(match[1]),
    body: match[2].trim(),
  };
}

export function generate(frontmatter) {
  const yamlStr = yaml.dump(frontmatter, { lineWidth: -1, sortKeys: true }).trim();
  return `---\n${yamlStr}\n---`;
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}

export function validateLinksTo(linksTo, index, plannedLinks = []) {
  if (!Array.isArray(linksTo) || linksTo.length === 0) {
    return { valid: [], dangling: [] };
  }

  const existingTitles = new Set(index.map(n => n.title.toLowerCase()));
  const plannedTitles = new Set(plannedLinks.map(t => t.toLowerCase()));

  const valid = [];
  const dangling = [];

  for (const title of linksTo) {
    const lower = title.toLowerCase();
    if (existingTitles.has(lower) || plannedTitles.has(lower)) {
      valid.push(title);
    } else {
      dangling.push(title);
    }
  }

  return { valid, dangling };
}

export function validate(frontmatter) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (frontmatter.type && !VALID_TYPES.includes(frontmatter.type)) {
    errors.push(`Invalid type: "${frontmatter.type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (frontmatter.source && !VALID_SOURCES.includes(frontmatter.source)) {
    errors.push(`Invalid source: "${frontmatter.source}". Must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (frontmatter.visibility && !VALID_VISIBILITY.includes(frontmatter.visibility)) {
    errors.push(`Invalid visibility: "${frontmatter.visibility}". Must be one of: ${VALID_VISIBILITY.join(', ')}`);
  }

  return errors;
}
