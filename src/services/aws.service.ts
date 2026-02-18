import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { SavedAwsCredentials, AwsCredentials, S3UploadResult } from '../types/aws.js';
import { encrypt, decrypt } from './encryption.service.js';
import { resolveConfigPaths, readEncryptionKey } from './config.service.js';
import { readJsonFile, writeJsonFile, fileExists, getFileSize } from '../utils/file.js';
import { S3UploadError } from '../utils/error.js';

// --- Credential management ---

export async function saveAwsCredentials(creds: AwsCredentials): Promise<string> {
  const paths = await resolveConfigPaths();
  const key = await readEncryptionKey();

  const saved: SavedAwsCredentials = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: encrypt(creds.secretAccessKey, key),
    region: creds.region,
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(paths.awsCredentialsFile, saved);
  return paths.awsCredentialsFile;
}

export async function loadAwsCredentials(): Promise<SavedAwsCredentials> {
  const paths = await resolveConfigPaths();
  return readJsonFile<SavedAwsCredentials>(paths.awsCredentialsFile);
}

export async function decryptAwsSecretKey(saved: SavedAwsCredentials): Promise<string> {
  const key = await readEncryptionKey();
  return decrypt(saved.secretAccessKey, key);
}

export async function getAwsCredentials(): Promise<AwsCredentials> {
  const saved = await loadAwsCredentials();
  const secretAccessKey = await decryptAwsSecretKey(saved);
  return {
    accessKeyId: saved.accessKeyId,
    secretAccessKey,
    region: saved.region,
  };
}

export async function hasAwsCredentials(): Promise<boolean> {
  const paths = await resolveConfigPaths();
  return fileExists(paths.awsCredentialsFile);
}

export async function deleteAwsCredentials(): Promise<void> {
  const paths = await resolveConfigPaths();
  await fs.unlink(paths.awsCredentialsFile);
}

// --- S3 operations ---

export function createS3Client(creds: AwsCredentials): S3Client {
  return new S3Client({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });
}

export async function verifyBucket(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

export function buildS3Key(prefix: string, fileName: string): string {
  if (!prefix || prefix === '') return fileName;
  // Ensure prefix doesn't have trailing slash duplication
  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return `${cleanPrefix}/${fileName}`;
}

export async function uploadFileToS3(
  client: S3Client,
  bucket: string,
  s3Key: string,
  localPath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<S3UploadResult> {
  const startTime = Date.now();
  const fileSize = await getFileSize(localPath);

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: s3Key,
        Body: createReadStream(localPath),
      },
    });

    if (onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        onProgress(progress.loaded ?? 0, fileSize);
      });
    }

    await upload.done();

    return {
      localPath,
      s3Key,
      status: 'success',
      fileSize,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new S3UploadError(`Failed to upload ${s3Key}: ${message}`, err instanceof Error ? err : undefined);
  }
}
