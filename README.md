# PGtoSnowflake

CLI tool for migrating PostgreSQL databases to Snowflake. Interactively map schemas and tables, export data to Parquet/CSV via DuckDB, and generate Snowflake-compatible DDL scripts.

## Features

- **Interactive menu** — run `pgtosnowflake` and navigate actions with arrow keys or number selection
- **Schema mapping** — connect to PostgreSQL, browse schemas/tables, save encrypted mapping files
- **Saved connections** — save and reuse PostgreSQL connection details across sessions
- **Data export** — export tables to Parquet (ZSTD compressed) or CSV using DuckDB's PostgreSQL extension
- **Interactive table selection** — choose specific schemas and tables to export during the export flow
- **DDL generation** — generate Snowflake `CREATE SCHEMA`, `CREATE TABLE`, and `ALTER TABLE` statements with correct type mappings
- **Encryption** — AES-256-GCM encryption for database passwords in mapping and connection files
- **S3 upload** — upload exported Parquet/CSV files to an AWS S3 bucket with multipart upload and progress bars
- **Logging** — file-based session logs for troubleshooting

## Prerequisites

- Node.js 20+
- Access to a PostgreSQL database
- (Optional) Snowflake account for deploying generated DDL
- (Optional) AWS credentials with S3 access for uploading exported files

## Installation

```bash
git clone https://github.com/marinoscar/PGtoSnowflake.git
cd PGtoSnowflake
npm install
npm run build
```

Run directly:

```bash
node dist/index.js
```

Or link globally:

```bash
npm link
pgtosnowflake
```

## Quick Start

1. Launch the interactive menu:

   ```bash
   pgtosnowflake
   ```

2. Select **Initialize config** to set up encryption. Choose local (project) or global (home directory) config, then auto-generate a key or enter a passphrase.

3. Select **Map PostgreSQL schema** to connect to a database. You can pick a saved connection or enter new details. After connecting, select schemas and tables. The mapping (with encrypted password) is saved to `.pgtosnowflake/mappings/`.

4. Select **Export data** to export table data. Choose a mapping file, select which tables to export (all or specific), and DuckDB exports each table.

5. Select **Generate Snowflake DDL** to create SQL scripts. Select a mapping and the tool writes a `.sql` file with `CREATE SCHEMA`, `CREATE TABLE`, primary keys, and foreign key constraints.

6. Select **Upload to S3** to upload exported files to an AWS S3 bucket. Configure AWS credentials (or skip at init and configure inline), select files, and upload with progress tracking.

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `ESC` | Any prompt | Go back to the previous level / main menu |
| `Ctrl+C` | Sub-command | Cancel current action, return to menu |
| `Ctrl+C` ×2 | Main menu | Exit the application (press twice within 2 seconds) |
| Arrow keys | Menu / list | Navigate options |
| Enter | Menu / list | Select option |

## Saved Connections

When mapping a PostgreSQL schema, the tool checks for saved connections:

- If saved connections exist, you can pick one or create a new connection
- Saved connections store host, port, database, user, encrypted password, and SSL settings
- After successfully connecting with new credentials, you'll be prompted to save the connection
- Connection files are stored in `.pgtosnowflake/connections/`

## CLI Options

| Option | Description |
|--------|-------------|
| `--version`, `-V` | Show version |
| `--help`, `-h` | Show help |

Running `pgtosnowflake` with no arguments launches the interactive menu.

## Type Mapping

The tool maps 30+ PostgreSQL types to their Snowflake equivalents:

| PostgreSQL | Snowflake | Notes |
|------------|-----------|-------|
| `int2` / `smallint` | `SMALLINT` | |
| `int4` / `serial` | `INTEGER` | serial becomes `IDENTITY(1,1)` |
| `int8` / `bigserial` | `BIGINT` | bigserial becomes `IDENTITY(1,1)` |
| `numeric(p,s)` | `NUMBER(p,s)` | Precision preserved |
| `float4` / `real` | `FLOAT` | |
| `float8` / `double precision` | `DOUBLE` | |
| `varchar(n)` | `VARCHAR(n)` | |
| `text` | `VARCHAR` | No length limit |
| `char(n)` | `CHAR(n)` | |
| `boolean` | `BOOLEAN` | |
| `date` | `DATE` | |
| `timestamp` | `TIMESTAMP_NTZ` | |
| `timestamptz` | `TIMESTAMP_TZ` | |
| `json` / `jsonb` | `VARIANT` | |
| `bytea` | `BINARY` | |
| `uuid` | `VARCHAR(36)` | |
| `interval` | `VARCHAR` | No Snowflake equivalent |
| `inet` / `cidr` | `VARCHAR(45)` / `VARCHAR(49)` | |
| Array types (`_int4`, etc.) | `ARRAY` | Comment notes base type |
| User-defined / enum | `VARCHAR` | Comment notes original type |

## Configuration

The `.pgtosnowflake/` directory contains:

```
.pgtosnowflake/
  key                  # AES-256-GCM encryption key (hex)
  aws.json             # AWS credentials (secret key encrypted)
  mappings/            # Mapping JSON files
  connections/         # Saved connection files
  logs/                # Session log files
```

Config is resolved in order: local (`./.pgtosnowflake/`) then global (`~/.pgtosnowflake/`).

**Important:** The `key` file contains your encryption key. Do not commit it to version control. If using local config, add `.pgtosnowflake/` to your `.gitignore` (already included by default).

## Project Structure

```
src/
  index.ts                          # Entry point (--version, --help, launches menu)
  menu.ts                           # Interactive menu loop
  constants.ts                      # App-wide constants
  types/                            # TypeScript interfaces
    config.ts, postgres.ts, mapping.ts, snowflake.ts, export.ts, connection.ts, aws.ts
  services/                         # Core business logic
    encryption.service.ts           # AES-256-GCM encrypt/decrypt
    config.service.ts               # Config directory + key management
    connection.service.ts           # Saved connection CRUD
    aws.service.ts                  # AWS credentials + S3 upload
    postgres.service.ts             # PG connection + schema introspection
    mapping.service.ts              # Mapping file read/write
    type-mapper.service.ts          # PG -> Snowflake type mapping
    ddl-generator.service.ts        # Snowflake DDL generation
    duckdb-export.service.ts        # DuckDB-based Parquet/CSV export
  commands/                         # CLI command handlers
    init.command.ts, map.command.ts, export.command.ts, generate-ddl.command.ts, upload.command.ts
  ui/                               # Terminal UI (chalk, ora, boxen, cli-table3)
    theme.ts, spinner.ts, prompts.ts, logger.ts, display.ts
  utils/                            # Helpers
    error.ts, file.ts, validation.ts, pg-queries.ts, log-file.ts
tests/
  services/                         # Unit tests for services
  utils/                            # Unit tests for utilities
  fixtures/                         # Sample data
docs/
  COMMANDS.md                       # Detailed command reference
  TROUBLESHOOTING.md                # Troubleshooting guide
```

## Troubleshooting

- **Log files**: check `.pgtosnowflake/logs/` for detailed session logs
- **Verbose mode**: select **Toggle verbose** from the menu to enable debug-level console output
- **Connection issues**: verify host, port, and credentials; check PostgreSQL `pg_hba.conf` for client access
- **DuckDB errors**: ensure the `@duckdb/node-api` package installed correctly for your platform
- **Encryption key errors**: make sure `.pgtosnowflake/key` exists and matches the key used when mapping was created

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more details.

## Development

```bash
npm run dev          # Run with tsx (no build needed)
npm run build        # Compile TypeScript
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## License

MIT
