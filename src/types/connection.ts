import type { EncryptedPayload } from './config.js';

export interface SavedConnection {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: EncryptedPayload;
  ssl: boolean;
  createdAt: string;
}
