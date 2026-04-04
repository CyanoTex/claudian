import { homedir } from 'os';
import { normalize } from 'path';

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
