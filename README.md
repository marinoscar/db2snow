# PGtoSnowflake

CLI tool for migrating PostgreSQL databases to Snowflake. Interactively map schemas and tables, export data to Parquet/CSV via DuckDB, and generate Snowflake-compatible DDL scripts.

## Features

- **Interactive REPL** — run `pgtosnowflake` and use commands in a persistent session
- **Schema mapping** — connect to PostgreSQL, browse schemas/tables, save encrypted mapping files
- **Data export** — export tables to Parquet (ZSTD compressed) or CSV using DuckDB's PostgreSQL extension
- **DDL generation** — generate Snowflake `CREATE SCHEMA`, `CREATE TABLE`, and `ALTER TABLE` statements with correct type mappings
- **Encryption** — AES-256-GCM encryption for database passwords in mapping files
- **Logging** — file-based session logs for troubleshooting

## Prerequisites

- Node.js 20+
- Access to a PostgreSQL database
- (Optional) Snowflake account for deploying generated DDL

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

1. Launch the interactive REPL:

   ```bash
   pgtosnowflake
   ```

2. Initialize encryption config:

   ```
   pg2sf > init
   ```

   Choose local (project) or global (home directory) config, then auto-generate a key or enter a passphrase.

3. Map a PostgreSQL database:

   ```
   pg2sf > map
   ```

   Enter connection details, select schemas and tables. The mapping (with encrypted password) is saved to `.pgtosnowflake/mappings/`.

4. Export data:

   ```
   pg2sf > export
   ```

   Select a mapping file, choose Parquet or CSV, and DuckDB exports each table.

5. Generate Snowflake DDL:

   ```
   pg2sf > generate-ddl
   ```

   Select a mapping and the tool writes a `.sql` file with `CREATE SCHEMA`, `CREATE TABLE`, primary keys, and foreign key constraints.

## Subcommand Usage

All commands can also be run directly from the shell:

```bash
pgtosnowflake init
pgtosnowflake map --host localhost --port 5432 --database mydb --user postgres
pgtosnowflake export --mapping my-project --format parquet
pgtosnowflake generate-ddl --mapping my-project --output snowflake.sql
pgtosnowflake generate-ddl --mapping my-project --preview
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--verbose` | Enable debug-level logging to console |
| `--version` | Show version |
| `--help` | Show help |

### `map` Flags

| Flag | Description |
|------|-------------|
| `-H, --host <host>` | PostgreSQL host |
| `-p, --port <port>` | PostgreSQL port |
| `-d, --database <db>` | Database name |
| `-U, --user <user>` | Username |
| `-W, --password <pw>` | Password |
| `-s, --ssl` | Use SSL |

### `export` Flags

| Flag | Description |
|------|-------------|
| `-m, --mapping <name>` | Mapping file name or path |
| `-t, --tables <list>` | Comma-separated table filter |
| `-f, --format <fmt>` | `parquet` or `csv` |
| `-o, --output-dir <dir>` | Output directory |

### `generate-ddl` Flags

| Flag | Description |
|------|-------------|
| `-m, --mapping <name>` | Mapping file name or path |
| `-o, --output <file>` | Output SQL file path |
| `--preview` | Print DDL to stdout |

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
  mappings/            # Mapping JSON files
  logs/                # Session log files
```

Config is resolved in order: local (`./.pgtosnowflake/`) then global (`~/.pgtosnowflake/`).

**Important:** The `key` file contains your encryption key. Do not commit it to version control. If using local config, add `.pgtosnowflake/` to your `.gitignore` (already included by default).

## Project Structure

```
src/
  index.ts                          # Entry point (CLI + REPL)
  repl.ts                           # Interactive REPL session
  constants.ts                      # App-wide constants
  types/                            # TypeScript interfaces
    config.ts, postgres.ts, mapping.ts, snowflake.ts, export.ts
  services/                         # Core business logic
    encryption.service.ts           # AES-256-GCM encrypt/decrypt
    config.service.ts               # Config directory + key management
    postgres.service.ts             # PG connection + schema introspection
    mapping.service.ts              # Mapping file read/write
    type-mapper.service.ts          # PG -> Snowflake type mapping
    ddl-generator.service.ts        # Snowflake DDL generation
    duckdb-export.service.ts        # DuckDB-based Parquet/CSV export
  commands/                         # CLI command handlers
    init.command.ts, map.command.ts, export.command.ts, generate-ddl.command.ts
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
- **Verbose mode**: pass `--verbose` or type `verbose on` in the REPL
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
