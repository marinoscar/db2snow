import path from 'node:path';
import { CONNECTION_FILE_EXTENSION } from '../constants.js';
import type { SavedConnection } from '../types/connection.js';
import type { PgConnectionConfig } from '../types/postgres.js';
import { encrypt, decrypt } from './encryption.service.js';
import { resolveConfigPaths, readEncryptionKey } from './config.service.js';
import { readJsonFile, writeJsonFile, listFiles, ensureDir } from '../utils/file.js';

export async function saveConnection(name: string, config: PgConnectionConfig): Promise<string> {
  const paths = await resolveConfigPaths();
  await ensureDir(paths.connectionsDir);
  const key = await readEncryptionKey();

  const saved: SavedConnection = {
    name,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: encrypt(config.password, key),
    ssl: config.ssl,
    createdAt: new Date().toISOString(),
  };

  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  await writeJsonFile(filePath, saved);
  return filePath;
}

export async function loadConnection(name: string): Promise<SavedConnection> {
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  return readJsonFile<SavedConnection>(filePath);
}

export async function listConnections(): Promise<string[]> {
  const paths = await resolveConfigPaths();
  const files = await listFiles(paths.connectionsDir, CONNECTION_FILE_EXTENSION);
  return files.map((f) => f.replace(CONNECTION_FILE_EXTENSION, ''));
}

export async function deleteConnection(name: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  await fs.unlink(filePath);
}

export function getConnectionConfig(saved: SavedConnection, decryptedPassword: string): PgConnectionConfig {
  return {
    host: saved.host,
    port: saved.port,
    database: saved.database,
    user: saved.user,
    password: decryptedPassword,
    ssl: saved.ssl,
  };
}

export async function decryptConnectionPassword(saved: SavedConnection): Promise<string> {
  const key = await readEncryptionKey();
  return decrypt(saved.password, key);
}
