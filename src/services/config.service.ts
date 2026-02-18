import path from 'node:path';
import os from 'node:os';
import { CONFIG_DIR_NAME, MAPPINGS_DIR_NAME, CONNECTIONS_DIR_NAME, LOGS_DIR_NAME, KEY_FILE_NAME, AWS_CREDENTIALS_FILE_NAME } from '../constants.js';
import type { ConfigLocation, ConfigPaths } from '../types/config.js';
import { ConfigNotFoundError } from '../utils/error.js';
import { dirExists, fileExists, ensureDir, readTextFile, writeTextFile } from '../utils/file.js';

function getLocalConfigDir(): string {
  return path.join(process.cwd(), CONFIG_DIR_NAME);
}

function getGlobalConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function buildPaths(configDir: string): ConfigPaths {
  return {
    configDir,
    mappingsDir: path.join(configDir, MAPPINGS_DIR_NAME),
    connectionsDir: path.join(configDir, CONNECTIONS_DIR_NAME),
    logsDir: path.join(configDir, LOGS_DIR_NAME),
    keyFile: path.join(configDir, KEY_FILE_NAME),
    awsCredentialsFile: path.join(configDir, AWS_CREDENTIALS_FILE_NAME),
  };
}

export function getConfigPaths(location: ConfigLocation): ConfigPaths {
  const configDir = location === 'local' ? getLocalConfigDir() : getGlobalConfigDir();
  return buildPaths(configDir);
}

export async function resolveConfigPaths(): Promise<ConfigPaths> {
  // Check local first
  const localDir = getLocalConfigDir();
  if (await dirExists(localDir)) {
    const localPaths = buildPaths(localDir);
    if (await fileExists(localPaths.keyFile)) {
      return localPaths;
    }
  }

  // Fall back to global
  const globalDir = getGlobalConfigDir();
  if (await dirExists(globalDir)) {
    const globalPaths = buildPaths(globalDir);
    if (await fileExists(globalPaths.keyFile)) {
      return globalPaths;
    }
  }

  throw new ConfigNotFoundError();
}

export async function isInitialized(location?: ConfigLocation): Promise<boolean> {
  if (location) {
    const paths = getConfigPaths(location);
    return fileExists(paths.keyFile);
  }
  try {
    await resolveConfigPaths();
    return true;
  } catch {
    return false;
  }
}

export async function initializeConfig(location: ConfigLocation, keyHex: string): Promise<ConfigPaths> {
  const paths = getConfigPaths(location);

  await ensureDir(paths.configDir);
  await ensureDir(paths.mappingsDir);
  await ensureDir(paths.connectionsDir);
  await ensureDir(paths.logsDir);
  await writeTextFile(paths.keyFile, keyHex);

  return paths;
}

export async function readEncryptionKey(): Promise<string> {
  const paths = await resolveConfigPaths();
  const key = (await readTextFile(paths.keyFile)).trim();
  return key;
}

export async function getConfigLocation(): Promise<ConfigLocation | null> {
  const localDir = getLocalConfigDir();
  if (await dirExists(localDir)) {
    const localPaths = buildPaths(localDir);
    if (await fileExists(localPaths.keyFile)) {
      return 'local';
    }
  }

  const globalDir = getGlobalConfigDir();
  if (await dirExists(globalDir)) {
    const globalPaths = buildPaths(globalDir);
    if (await fileExists(globalPaths.keyFile)) {
      return 'global';
    }
  }

  return null;
}
