// Minimal YAML parser/dumper for Claudian.
// Covers the subset used by vault frontmatter and config.yaml:
// scalars, quoted strings, inline arrays, block sequences, nested mappings.

export function load(text) {
  if (text == null || typeof text !== 'string') return null;

  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const stripped = stripComment(raw);
    if (stripped.trim() === '') continue;
    const indent = stripped.search(/\S/);
    lines.push({ indent, content: stripped.trim() });
  }

  if (lines.length === 0) return null;
  return parseBlock(lines, 0, lines.length, lines[0].indent);
}

export function dump(obj, options = {}) {
  if (obj == null) return 'null\n';
  const sortKeys = options.sortKeys ?? false;
  return dumpMapping(obj, 0, sortKeys) + '\n';
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function stripComment(line) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || line[i - 1] === ' ')) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

function parseBlock(lines, from, to, baseIndent) {
  if (from >= to) return null;
  const first = lines[from].content;
  if (first.startsWith('- ') || first === '-') {
    return parseSequence(lines, from, to, baseIndent);
  }
  return parseMapping(lines, from, to, baseIndent);
}

function parseMapping(lines, from, to, baseIndent) {
  const result = {};
  let i = from;

  while (i < to) {
    const line = lines[i];
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) { i++; continue; }

    const sep = findKeySep(line.content);
    if (sep === -1) { i++; continue; }

    const key = line.content.slice(0, sep).trim();
    const rest = line.content.slice(sep + 1).trim();

    if (rest !== '') {
      result[key] = parseInlineValue(rest);
      i++;
    } else {
      i++;
      if (i < to && lines[i].indent > baseIndent) {
        const childIndent = lines[i].indent;
        const childFrom = i;
        while (i < to && lines[i].indent >= childIndent) i++;
        result[key] = parseBlock(lines, childFrom, i, childIndent);
      } else {
        result[key] = null;
      }
    }
  }

  return result;
}

function parseSequence(lines, from, to, baseIndent) {
  const result = [];
  let i = from;

  while (i < to && lines[i].indent === baseIndent) {
    const line = lines[i];
    if (!line.content.startsWith('- ') && line.content !== '-') break;

    const rest = line.content === '-' ? '' : line.content.slice(2).trim();

    if (rest === '') {
      i++;
      if (i < to && lines[i].indent > baseIndent) {
        const childIndent = lines[i].indent;
        const childFrom = i;
        while (i < to && lines[i].indent >= childIndent) i++;
        result.push(parseBlock(lines, childFrom, i, childIndent));
      } else {
        result.push(null);
      }
    } else if (findKeySep(rest) !== -1) {
      const itemIndent = baseIndent + 2;
      const mapLines = [{ indent: itemIndent, content: rest }];
      i++;
      while (i < to && lines[i].indent >= itemIndent) {
        mapLines.push(lines[i]);
        i++;
      }
      result.push(parseMapping(mapLines, 0, mapLines.length, itemIndent));
    } else {
      result.push(parseInlineValue(rest));
      i++;
    }
  }

  return result;
}

function findKeySep(text) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      if (i + 1 === text.length || text[i + 1] === ' ') return i;
    }
  }
  return -1;
}

function parseInlineValue(str) {
  if (str[0] === '[') {
    if (str[str.length - 1] !== ']') throw new Error(`Unterminated inline array: ${str}`);
    return parseInlineArray(str);
  }
  if (str[0] === '{') {
    if (str[str.length - 1] !== '}') throw new Error(`Unterminated inline object: ${str}`);
    return parseInlineObject(str);
  }
  return parseScalar(str);
}

function parseInlineObject(str) {
  const inner = str.slice(1, -1).trim();
  if (inner === '') return {};

  const result = {};
  let current = '';
  let inSingle = false, inDouble = false, depth = 0;

  for (const ch of inner) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if ((ch === '[' || ch === '{') && !inSingle && !inDouble) depth++;
    else if ((ch === ']' || ch === '}') && !inSingle && !inDouble) depth--;

    if (ch === ',' && !inSingle && !inDouble && depth === 0) {
      addInlineEntry(current.trim(), result);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) addInlineEntry(current.trim(), result);

  return result;
}

function addInlineEntry(str, result) {
  const sep = findKeySep(str);
  if (sep === -1) return;
  const key = str.slice(0, sep).trim();
  const val = str.slice(sep + 1).trim();
  result[key] = val ? parseScalar(val) : null;
}

function parseInlineArray(str) {
  const inner = str.slice(1, -1).trim();
  if (inner === '') return [];

  const items = [];
  let current = '';
  let inSingle = false, inDouble = false, depth = 0;

  for (const ch of inner) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '[' && !inSingle && !inDouble) depth++;
    else if (ch === ']' && !inSingle && !inDouble) depth--;

    if (ch === ',' && !inSingle && !inDouble && depth === 0) {
      items.push(parseScalar(current.trim()));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(parseScalar(current.trim()));

  return items;
}

function parseScalar(str) {
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Quoted strings
  if (str.length >= 2) {
    if (str[0] === '"' && str[str.length - 1] === '"') return str.slice(1, -1);
    if (str[0] === "'" && str[str.length - 1] === "'") return str.slice(1, -1);
  }

  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);

  return str;
}

// ---------------------------------------------------------------------------
// Dumper
// ---------------------------------------------------------------------------

function dumpMapping(obj, indent, sortKeys) {
  const keys = Object.keys(obj);
  if (sortKeys) keys.sort();
  const prefix = ' '.repeat(indent);
  const parts = [];

  for (const key of keys) {
    const val = obj[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      parts.push(prefix + key + ':\n' + dumpMapping(val, indent + 2, sortKeys));
    } else {
      parts.push(prefix + key + ': ' + dumpValue(val));
    }
  }

  return parts.join('\n');
}

function dumpValue(value) {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return dumpInlineArray(value);
  if (typeof value === 'string') return dumpString(value);
  return String(value);
}

function dumpInlineArray(arr) {
  if (arr.length === 0) return '[]';
  return '[' + arr.map(dumpFlowItem).join(', ') + ']';
}

function dumpFlowItem(value) {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.includes(',') || value.includes('[') || value.includes(']') ||
        value.includes('{') || value.includes('}')) {
      return "'" + value.replace(/'/g, "''") + "'";
    }
    return dumpString(value);
  }
  return String(value);
}

const YAML_KEYWORDS = new Set([
  'null', 'true', 'false', 'yes', 'no', 'on', 'off', '~',
]);

function dumpString(str) {
  if (needsQuoting(str)) return "'" + str.replace(/'/g, "''") + "'";
  return str;
}

function needsQuoting(str) {
  if (str === '') return true;
  if (YAML_KEYWORDS.has(str.toLowerCase())) return true;
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
  if (/^[{[&*!|>'"%@`?]/.test(str)) return true;
  if (str.startsWith('- ') || str.startsWith(': ')) return true;
  if (str.includes(': ') || str.includes(' #') || str.includes('\n')) return true;
  return false;
}

export default { load, dump };
