import path from 'node:path';
import type { ExportFormat, ExportSummary } from '../types/export.js';
import { isInitialized } from '../services/config.service.js';
import { listMappingFiles, loadMappingFile, loadMappingFileByPath, decryptPassword, getConnectionFromMapping } from '../services/mapping.service.js';
import { exportTables } from '../services/duckdb-export.service.js';
import { promptSelect, promptCheckbox } from '../ui/prompts.js';
import { startSpinner, updateSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { logSuccess, logError, logWarning, logInfo, logStep, logBlank } from '../ui/logger.js';
import { showSummaryTable } from '../ui/display.js';
import { theme } from '../ui/theme.js';
import { formatFileSize } from '../utils/file.js';
import { logInfo as fileLogInfo, logError as fileLogError } from '../utils/log-file.js';

interface ExportCommandOptions {
  mapping?: string;
  tables?: string;
  format?: ExportFormat;
  outputDir?: string;
}

async function selectTablesInteractively(
  tables: { schemaName: string; tableName: string }[],
): Promise<{ schemaName: string; tableName: string }[]> {
  // Group tables by schema
  const bySchema = new Map<string, string[]>();
  for (const t of tables) {
    const existing = bySchema.get(t.schemaName) || [];
    existing.push(t.tableName);
    bySchema.set(t.schemaName, existing);
  }

  const selected: { schemaName: string; tableName: string }[] = [];

  for (const [schemaName, tableNames] of bySchema) {
    const choice = await promptSelect<string>(
      `Tables from ${schemaName}:`,
      [
        { name: `All ${tableNames.length} tables`, value: '__all__' },
        { name: 'Select specific tables...', value: '__pick__' },
      ],
    );

    if (choice === '__all__') {
      for (const tableName of tableNames) {
        selected.push({ schemaName, tableName });
      }
    } else {
      const picked = await promptCheckbox(
        `Select tables from ${schemaName}:`,
        tableNames.map((t) => ({ name: t, value: t, checked: true })),
      );
      for (const tableName of picked) {
        selected.push({ schemaName, tableName });
      }
    }
  }

  return selected;
}

export async function runExport(options: ExportCommandOptions = {}): Promise<void> {
  // 1. Verify init
  const initialized = await isInitialized();
  if (!initialized) {
    logError('Configuration not found. Run "init" first.');
    return;
  }

  logStep('Data Export via DuckDB');
  logBlank();

  // 2. Load mapping
  let mapping;
  try {
    if (options.mapping) {
      // Check if it's a path or a name
      if (options.mapping.includes(path.sep) || options.mapping.includes('/') || options.mapping.endsWith('.json')) {
        mapping = await loadMappingFileByPath(options.mapping);
      } else {
        mapping = await loadMappingFile(options.mapping);
      }
    } else {
      const mappingNames = await listMappingFiles();
      if (mappingNames.length === 0) {
        logError('No mapping files found. Run "map" first to create one.');
        return;
      }
      const selectedName = await promptSelect(
        'Select a mapping file:',
        mappingNames.map((n) => ({ name: n, value: n })),
      );
      mapping = await loadMappingFile(selectedName);
    }
  } catch (err) {
    if (err instanceof Error) logError(err.message);
    return;
  }

  // 3. Decrypt password
  let decryptedPassword: string;
  try {
    decryptedPassword = await decryptPassword(mapping);
  } catch (err) {
    logError('Failed to decrypt password. Check your encryption key.');
    if (err instanceof Error) logError(err.message);
    return;
  }

  const pgConfig = getConnectionFromMapping(mapping, decryptedPassword);

  // 4. Determine tables to export
  const allTables = mapping.tables.map((t) => ({
    schemaName: t.schemaName,
    tableName: t.tableName,
  }));

  let tablesToExport: { schemaName: string; tableName: string }[];

  if (options.tables) {
    // CLI override — filter by provided names
    const filterNames = options.tables.split(',').map((t) => t.trim());
    tablesToExport = allTables.filter((t) =>
      filterNames.includes(t.tableName) || filterNames.includes(`${t.schemaName}.${t.tableName}`),
    );

    if (tablesToExport.length === 0) {
      logWarning('No matching tables found for the specified filter.');
      return;
    }
  } else {
    // Interactive table selection
    tablesToExport = await selectTablesInteractively(allTables);

    if (tablesToExport.length === 0) {
      logWarning('No tables selected. Aborting.');
      return;
    }
  }

  // 5. Determine format
  let format: ExportFormat;
  if (options.format) {
    format = options.format;
  } else if (mapping.exportOptions.format) {
    format = mapping.exportOptions.format;
  } else {
    format = await promptSelect<ExportFormat>(
      'Export format:',
      [
        { name: 'Parquet', value: 'parquet' },
        { name: 'CSV', value: 'csv' },
      ],
    );
  }

  // 6. Determine output directory
  const outputDir = options.outputDir || mapping.exportOptions.outputDir || './export';

  logInfo(`Exporting ${tablesToExport.length} tables as ${format.toUpperCase()} to ${theme.path(outputDir)}`);
  logBlank();

  await fileLogInfo('export', `Starting export: ${tablesToExport.length} tables, format=${format}, outputDir=${outputDir}`);

  // 7. Export
  startSpinner('Starting export...');

  const results = await exportTables(
    pgConfig,
    tablesToExport,
    format,
    outputDir,
    (tableName, index, total) => {
      updateSpinner(`Exporting ${tableName} (${index + 1}/${total})...`);
    },
  );

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  if (errorCount === 0) {
    succeedSpinner(`Exported ${successCount} tables successfully`);
  } else if (successCount > 0) {
    succeedSpinner(`Exported ${successCount} tables (${errorCount} failed)`);
  } else {
    failSpinner(`All ${errorCount} exports failed`);
  }

  // 8. Summary
  logBlank();
  const summaryRows = results.map((r) => [
    `${r.schemaName}.${r.tableName}`,
    r.status === 'success' ? theme.success('OK') : theme.error('FAIL'),
    r.status === 'success' ? String(r.rowCount) : '-',
    `${(r.duration / 1000).toFixed(1)}s`,
    r.status === 'success' ? formatFileSize(r.fileSize) : r.error || 'Unknown error',
  ]);
  showSummaryTable(['Table', 'Status', 'Rows', 'Duration', 'Size/Error'], summaryRows);

  const summary: ExportSummary = {
    totalTables: results.length,
    successCount,
    errorCount,
    totalRows: results.reduce((sum, r) => sum + r.rowCount, 0),
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    results,
  };

  await fileLogInfo('export', `Export complete: ${summary.successCount}/${summary.totalTables} succeeded, ${summary.totalRows} total rows`);

  if (errorCount > 0) {
    logWarning(`${errorCount} table(s) failed to export. Check logs for details.`);
    for (const r of results.filter((r) => r.status === 'error')) {
      await fileLogError('export', `Failed: ${r.schemaName}.${r.tableName}: ${r.error}`);
    }
  }

  logBlank();
}
