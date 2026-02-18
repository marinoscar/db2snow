export interface EncryptedPayload {
  encrypted: true;
  algorithm: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface ConfigPaths {
  configDir: string;
  mappingsDir: string;
  connectionsDir: string;
  logsDir: string;
  keyFile: string;
  awsCredentialsFile: string;
}

export type ConfigLocation = 'local' | 'global';

export type KeyGenerationMethod = 'auto' | 'passphrase';
