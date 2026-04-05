import { homedir, tmpdir } from 'os';
import { normalize, join } from 'path';

export function resolveHome(filepath) {
  if (filepath === '~') return normalizePath(homedir());
  if (filepath.startsWith('~/')) {
    return normalizePath(homedir() + '/' + filepath.slice(2));
  }
  return filepath;
}

export function platformDefault() {
  if (process.platform === 'linux') return '~/claudian-vault';
  return '~/Documents/Claudian-Vault';
}

export function normalizePath(filepath) {
  return normalize(filepath).replace(/\\/g, '/');
}

export function cachePointerPath() {
  const raw = process.env.CLAUDE_SESSION_ID || 'default';
  const sessionId = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(tmpdir(), 'claudian', `active-cache-${sessionId}.txt`);
}
