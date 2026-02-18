#!/usr/bin/env node

import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from './constants.js';
import { startMenu } from './menu.js';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-V')) {
  console.log(`${APP_NAME} v${APP_VERSION}`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`${APP_NAME} v${APP_VERSION} — ${APP_DESCRIPTION}\n`);
  console.log('Usage: pgtosnowflake\n');
  console.log('Launches an interactive menu to guide you through:');
  console.log('  - Initializing encryption config');
  console.log('  - Mapping PostgreSQL schemas');
  console.log('  - Exporting data to Parquet/CSV');
  console.log('  - Generating Snowflake DDL\n');
  console.log('Options:');
  console.log('  -V, --version  Show version');
  console.log('  -h, --help     Show this help');
  process.exit(0);
}

if (args.length > 0) {
  console.error(`Unknown argument: ${args[0]}`);
  console.error('Run "pgtosnowflake" with no arguments to launch the interactive menu.');
  process.exit(1);
}

startMenu();
