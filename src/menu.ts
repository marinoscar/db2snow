import { select } from '@inquirer/prompts';
import { ExitPromptError, AbortPromptError } from '@inquirer/core';
import { isInitialized, resolveConfigPaths } from './services/config.service.js';
import { listMappingFiles } from './services/mapping.service.js';
import { runInit } from './commands/init.command.js';
import { runMap } from './commands/map.command.js';
import { runExport } from './commands/export.command.js';
import { runGenerateDDL } from './commands/generate-ddl.command.js';
import { runUpload } from './commands/upload.command.js';
import { showBanner, showStatusLine, showLegend } from './ui/display.js';
import { logInfo, logBlank, logWarning } from './ui/logger.js';
import { setVerbose, isVerbose, initLogFile } from './utils/log-file.js';

type MenuAction = 'init' | 'map' | 'export' | 'generate-ddl' | 'upload' | 'verbose' | 'exit';

const DOUBLE_TAP_MS = 2000;

function getMenuChoices(): { name: string; value: MenuAction; description: string }[] {
  const verboseState = isVerbose() ? 'ON' : 'OFF';
  return [
    { name: '1. Initialize config', value: 'init', description: 'Set up encryption key and config directory' },
    { name: '2. Map PostgreSQL schema', value: 'map', description: 'Connect to PostgreSQL and create a schema mapping' },
    { name: '3. Export data', value: 'export', description: 'Export table data to Parquet or CSV via DuckDB' },
    { name: '4. Generate Snowflake DDL', value: 'generate-ddl', description: 'Generate Snowflake DDL from a mapping file' },
    { name: '5. Upload to S3', value: 'upload', description: 'Upload exported files to an S3 bucket' },
    { name: `6. Toggle verbose (${verboseState})`, value: 'verbose', description: 'Enable/disable debug logging to console' },
    { name: '7. Exit', value: 'exit', description: 'Exit the application' },
  ];
}

async function refreshStatusLine(): Promise<void> {
  const initialized = await isInitialized();
  let activeMappings: string[] = [];
  if (initialized) {
    try {
      activeMappings = await listMappingFiles();
    } catch {
      // Ignore
    }
  }
  showStatusLine(initialized, activeMappings.length > 0 ? `${activeMappings.length} mapping(s)` : undefined);
}

export async function startMenu(): Promise<void> {
  // Initialize logging if config exists
  try {
    const paths = await resolveConfigPaths();
    await initLogFile(paths.logsDir);
  } catch {
    // Config not initialized yet — logging will start after init
  }

  showBanner();

  let lastCtrlCTime = 0;

  while (true) {
    await refreshStatusLine();
    showLegend();

    let action: MenuAction;
    try {
      action = await select({
        message: 'What would you like to do?',
        choices: getMenuChoices(),
      });
    } catch (err) {
      if (err instanceof ExitPromptError) {
        const now = Date.now();
        if (now - lastCtrlCTime < DOUBLE_TAP_MS) {
          logBlank();
          logInfo('Goodbye!');
          process.exit(0);
        }
        lastCtrlCTime = now;
        logBlank();
        logWarning('Press Ctrl+C again to exit');
        continue;
      }
      if (err instanceof AbortPromptError) {
        // ESC at main menu — just re-render
        continue;
      }
      throw err;
    }

    // Reset Ctrl+C timer on successful selection
    lastCtrlCTime = 0;

    if (action === 'exit') {
      logBlank();
      logInfo('Goodbye!');
      process.exit(0);
    }

    if (action === 'verbose') {
      const newState = !isVerbose();
      setVerbose(newState);
      logInfo(`Verbose logging ${newState ? 'enabled' : 'disabled'}`);
      continue;
    }

    try {
      switch (action) {
        case 'init':
          await runInit();
          // Re-initialize logging after init
          try {
            const paths = await resolveConfigPaths();
            await initLogFile(paths.logsDir);
          } catch {
            // Ignore
          }
          break;
        case 'map':
          await runMap();
          break;
        case 'export':
          await runExport();
          break;
        case 'generate-ddl':
          await runGenerateDDL();
          break;
        case 'upload':
          await runUpload();
          break;
      }
    } catch (err) {
      if (err instanceof AbortPromptError) {
        logBlank();
        logInfo('Returned to menu.');
      } else if (err instanceof ExitPromptError) {
        logBlank();
        logWarning('Action cancelled.');
      } else if (err instanceof Error) {
        logBlank();
        logWarning(err.message);
      }
    }
  }
}
