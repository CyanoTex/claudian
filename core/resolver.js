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
  const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
  return join(tmpdir(), 'claudian', `active-cache-${sessionId}.txt`);
}
