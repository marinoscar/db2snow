import path from 'node:path';
import fs from 'node:fs/promises';
import cliProgress from 'cli-progress';
import { isInitialized } from '../services/config.service.js';
import {
  hasAwsCredentials,
  getAwsCredentials,
  saveAwsCredentials,
  createS3Client,
  verifyBucket,
  buildS3Key,
  uploadFileToS3,
} from '../services/aws.service.js';
import type { AwsCredentials, S3UploadResult } from '../types/aws.js';
import { DEFAULT_AWS_REGION, DEFAULT_OUTPUT_DIR } from '../constants.js';
import { promptInput, promptPassword, promptConfirm, promptCheckbox } from '../ui/prompts.js';
import { startSpinner, succeedSpinner, failSpinner, stopSpinner } from '../ui/spinner.js';
import { logSuccess, logError, logWarning, logInfo, logStep, logBlank } from '../ui/logger.js';
import { showSummaryTable } from '../ui/display.js';
import { theme } from '../ui/theme.js';
import { formatFileSize, getFileSize } from '../utils/file.js';
import { validateS3BucketName, validateS3Prefix, validateNonEmpty } from '../utils/validation.js';
import { logInfo as fileLogInfo, logError as fileLogError } from '../utils/log-file.js';

async function promptAwsCredentials(): Promise<AwsCredentials> {
  const accessKeyId = await promptInput('AWS Access Key ID:', undefined, validateNonEmpty);
  const secretAccessKey = await promptPassword('AWS Secret Access Key:');
  if (!secretAccessKey) {
    throw new Error('Secret access key is required');
  }
  const region = await promptInput('AWS Region:', DEFAULT_AWS_REGION);

  return { accessKeyId, secretAccessKey, region };
}

async function scanExportFiles(dir: string): Promise<{ name: string; fullPath: string; size: number }[]> {
  const entries = await fs.readdir(dir);
  const files: { name: string; fullPath: string; size: number }[] = [];

  for (const entry of entries) {
    if (entry.endsWith('.parquet') || entry.endsWith('.csv')) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        files.push({ name: entry, fullPath, size: stat.size });
      }
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function runUpload(): Promise<void> {
  // 1. Verify config initialized
  const initialized = await isInitialized();
  if (!initialized) {
    logError('Configuration not found. Run "init" first.');
    return;
  }

  logStep('Upload to S3');
  logBlank();

  // 2. Check AWS credentials
  let creds: AwsCredentials;
  const hasCreds = await hasAwsCredentials();

  if (!hasCreds) {
    logWarning('AWS credentials not configured.');
    const configureNow = await promptConfirm('Configure AWS credentials now?', true);
    if (!configureNow) {
      logInfo('Run "init" to configure AWS credentials.');
      return;
    }

    logBlank();
    creds = await promptAwsCredentials();
    await saveAwsCredentials(creds);
    logSuccess('AWS credentials saved');
    logBlank();
  } else {
    try {
      creds = await getAwsCredentials();
    } catch (err) {
      logError('Failed to decrypt AWS credentials. Check your encryption key.');
      if (err instanceof Error) logError(err.message);
      return;
    }
  }

  // 3. Create S3 client
  const client = createS3Client(creds);

  // 4. Prompt for bucket name
  const bucket = await promptInput('S3 bucket name:', undefined, validateS3BucketName);

  // 5. Verify bucket exists
  startSpinner(`Verifying bucket ${theme.value(bucket)}...`);
  const bucketExists = await verifyBucket(client, bucket);
  if (!bucketExists) {
    failSpinner(`Bucket "${bucket}" not found or access denied`);
    logBlank();
    logWarning('Check that the bucket exists and your credentials have s3:HeadBucket permission.');
    return;
  }
  succeedSpinner(`Bucket "${bucket}" verified`);
  logBlank();

  // 6. Prompt for export directory
  const exportDir = await promptInput('Export directory:', DEFAULT_OUTPUT_DIR);

  // 7. Scan for files
  let files: { name: string; fullPath: string; size: number }[];
  try {
    files = await scanExportFiles(exportDir);
  } catch {
    logError(`Directory not found: ${theme.path(exportDir)}`);
    logInfo('Run "export" first to export data.');
    return;
  }

  if (files.length === 0) {
    logWarning(`No .parquet or .csv files found in ${theme.path(exportDir)}`);
    return;
  }

  logInfo(`Found ${files.length} file(s) in ${theme.path(exportDir)}:`);
  for (const f of files) {
    logInfo(`  ${f.name} (${formatFileSize(f.size)})`);
  }
  logBlank();

  // 8. Select files
  let selectedFiles = files;
  if (files.length > 1) {
    const uploadAll = await promptConfirm(`Upload all ${files.length} files?`, true);
    if (!uploadAll) {
      const picked = await promptCheckbox(
        'Select files to upload:',
        files.map((f) => ({
          name: `${f.name} (${formatFileSize(f.size)})`,
          value: f.name,
          checked: true,
        })),
      );
      selectedFiles = files.filter((f) => picked.includes(f.name));
      if (selectedFiles.length === 0) {
        logWarning('No files selected. Aborting.');
        return;
      }
    }
  }

  // 9. Prompt for S3 key prefix
  const defaultPrefix = path.basename(path.resolve(exportDir));
  const prefix = await promptInput('S3 key prefix:', defaultPrefix, validateS3Prefix);
  logBlank();

  // 10. Upload files with progress bars
  const multiBar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: '  {bar} | {percentage}% | {label}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    },
    cliProgress.Presets.shades_classic,
  );

  const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const overallBar = multiBar.create(totalBytes, 0, { label: 'Overall' });
  let uploadedBytes = 0;

  const results: S3UploadResult[] = [];

  try {
    for (const file of selectedFiles) {
      const s3Key = buildS3Key(prefix, file.name);
      const fileBar = multiBar.create(file.size, 0, { label: file.name.slice(0, 30) });

      try {
        const result = await uploadFileToS3(
          client,
          bucket,
          s3Key,
          file.fullPath,
          (loaded) => {
            fileBar.update(loaded);
          },
        );
        fileBar.update(file.size);
        uploadedBytes += file.size;
        overallBar.update(uploadedBytes);
        results.push(result);
      } catch (err) {
        fileBar.update(file.size);
        uploadedBytes += file.size;
        overallBar.update(uploadedBytes);
        results.push({
          localPath: file.fullPath,
          s3Key,
          status: 'error',
          fileSize: file.size,
          duration: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      multiBar.remove(fileBar);
    }
  } finally {
    multiBar.stop();
  }

  // 11. Show summary
  logBlank();
  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  if (errorCount === 0) {
    logSuccess(`Uploaded ${successCount} file(s) to s3://${bucket}/${prefix}`);
  } else if (successCount > 0) {
    logWarning(`Uploaded ${successCount} file(s), ${errorCount} failed`);
  } else {
    logError(`All ${errorCount} upload(s) failed`);
  }

  logBlank();
  const summaryRows = results.map((r) => [
    path.basename(r.localPath),
    r.status === 'success' ? theme.success('OK') : theme.error('FAIL'),
    formatFileSize(r.fileSize),
    r.status === 'success' ? `${(r.duration / 1000).toFixed(1)}s` : '-',
    r.status === 'success' ? `s3://${bucket}/${r.s3Key}` : (r.error || 'Unknown error'),
  ]);
  showSummaryTable(['File', 'Status', 'Size', 'Duration', 'S3 Key / Error'], summaryRows);

  // 12. Log to file
  await fileLogInfo('upload', `Upload complete: ${successCount}/${results.length} succeeded, bucket=${bucket}, prefix=${prefix}`);
  for (const r of results.filter((r) => r.status === 'error')) {
    await fileLogError('upload', `Failed: ${r.s3Key}: ${r.error}`);
  }

  logBlank();
}
