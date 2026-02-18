import type { ConfigLocation, KeyGenerationMethod } from '../types/config.js';
import { generateRandomKey, deriveKeyFromPassphrase } from '../services/encryption.service.js';
import { getConfigPaths, isInitialized, initializeConfig } from '../services/config.service.js';
import { saveAwsCredentials } from '../services/aws.service.js';
import { DEFAULT_AWS_REGION } from '../constants.js';
import { promptSelect, promptConfirm, promptPassword, promptInput } from '../ui/prompts.js';
import { logSuccess, logWarning, logInfo, logStep, logBlank } from '../ui/logger.js';
import { theme } from '../ui/theme.js';
import { validateNonEmpty } from '../utils/validation.js';
import { logInfo as fileLogInfo } from '../utils/log-file.js';

export async function runInit(): Promise<void> {
  logStep('Setting up pgtosnowflake configuration');
  logBlank();

  // 1. Choose location
  const location = await promptSelect<ConfigLocation>(
    'Where should the configuration be stored?',
    [
      { name: 'Local (current directory)', value: 'local', description: 'Project-level config in ./.pgtosnowflake/' },
      { name: 'Global (home directory)', value: 'global', description: 'User-level config in ~/.pgtosnowflake/' },
    ],
  );

  // 2. Check if already initialized
  const alreadyInit = await isInitialized(location);
  if (alreadyInit) {
    const paths = getConfigPaths(location);
    logWarning(`Configuration already exists at ${theme.path(paths.configDir)}`);
    const overwrite = await promptConfirm('Overwrite existing configuration?', false);
    if (!overwrite) {
      logInfo('Initialization cancelled.');
      return;
    }
  }

  // 3. Choose key generation method
  const method = await promptSelect<KeyGenerationMethod>(
    'How should the encryption key be generated?',
    [
      { name: 'Auto-generate (recommended)', value: 'auto', description: 'Generate a random 256-bit key' },
      { name: 'Custom passphrase', value: 'passphrase', description: 'Derive a key from your own passphrase' },
    ],
  );

  let keyHex: string;
  if (method === 'auto') {
    keyHex = generateRandomKey();
    logInfo('Generated random 256-bit encryption key');
  } else {
    const passphrase = await promptPassword('Enter your passphrase:');
    if (!passphrase || passphrase.length < 8) {
      logWarning('Passphrase must be at least 8 characters');
      return;
    }
    const confirm = await promptPassword('Confirm your passphrase:');
    if (passphrase !== confirm) {
      logWarning('Passphrases do not match');
      return;
    }
    keyHex = deriveKeyFromPassphrase(passphrase);
    logInfo('Derived encryption key from passphrase');
  }

  // 4. Create config
  const paths = await initializeConfig(location, keyHex);
  await fileLogInfo('init', `Configuration initialized at ${paths.configDir}`);

  // 5. Optional AWS credentials setup
  logBlank();
  const configureAws = await promptConfirm('Configure AWS credentials for S3 uploads?', false);
  if (configureAws) {
    const accessKeyId = await promptInput('AWS Access Key ID:', undefined, validateNonEmpty);
    const secretAccessKey = await promptPassword('AWS Secret Access Key:');
    if (!secretAccessKey) {
      logWarning('Secret access key is required. Skipping AWS configuration.');
    } else {
      const region = await promptInput('AWS Region:', DEFAULT_AWS_REGION);
      await saveAwsCredentials({ accessKeyId, secretAccessKey, region });
      logSuccess('AWS credentials saved');
    }
  }

  logBlank();
  logSuccess(`Configuration initialized at ${theme.path(paths.configDir)}`);
  logInfo(`  Key file:    ${theme.path(paths.keyFile)}`);
  logInfo(`  Mappings:    ${theme.path(paths.mappingsDir)}`);
  logInfo(`  Logs:        ${theme.path(paths.logsDir)}`);
  logInfo(`  AWS creds:   ${theme.path(paths.awsCredentialsFile)}`);

  // 6. Suggest .gitignore for local config
  if (location === 'local') {
    logBlank();
    logWarning('Consider adding .pgtosnowflake/ to your .gitignore to keep your key safe.');
  }

  logBlank();
}
