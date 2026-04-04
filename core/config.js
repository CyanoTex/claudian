import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { resolveHome, normalizePath } from './resolver.js';

export const CONFIG_FILENAME = 'config.yaml';

export function globalConfigPath() {
  return resolveHome('~/.claudian/' + CONFIG_FILENAME);
}

export async function load() {
  return loadFrom(globalConfigPath());
}

export async function loadFrom(configPath) {
  const content = await readFile(configPath, 'utf-8');
  const config = yaml.load(content);
  if (!config || !config.vaults) {
    throw new Error('Invalid Claudian config: missing "vaults" key');
  }
  return config;
}

export function detectProject(config, cwd) {
  const normalCwd = normalizePath(cwd);

  for (const vault of config.vaults) {
    for (const [name, project] of Object.entries(vault.projects || {})) {
      const repoPath = normalizePath(resolveHome(project.repo));
      if (normalCwd === repoPath || normalCwd.startsWith(repoPath + '/')) {
        return { vault, project: name, ...project };
      }
    }
  }

  return { vault: config.vaults[0], project: null, tags: [] };
}
