# db2snow

CLI tool for migrating databases to Snowflake. Supports PostgreSQL, MySQL, and SQL Server as source engines. Interactively map schemas and tables, export data to Parquet/CSV via DuckDB, and generate Snowflake-compatible DDL scripts.

## Features

- **Interactive menu** — run `db2snow` and navigate actions with arrow keys or number selection
- **Multi-engine support** — connect to PostgreSQL, MySQL, or SQL Server via a unified adapter pattern
- **Schema mapping** — browse schemas/tables, save encrypted mapping files
- **Saved connections** — save and reuse database connection details across sessions
- **Data export** — export tables to Parquet (ZSTD compressed) or CSV using DuckDB
- **Interactive table selection** — choose specific schemas and tables to export during the export flow
- **DDL generation** — generate Snowflake `CREATE SCHEMA`, `CREATE TABLE`, and `ALTER TABLE` statements with engine-specific type mappings
- **Encryption** — AES-256-GCM encryption for database passwords in mapping and connection files
- **S3 upload** — upload exported Parquet/CSV files to an AWS S3 bucket with multipart upload and progress bars
- **Logging** — file-based session logs for troubleshooting

## Prerequisites

- Node.js 20+
- Access to a source database (PostgreSQL, MySQL, or SQL Server)
- (Optional) Snowflake account for deploying generated DDL
- (Optional) AWS credentials with S3 access for uploading exported files

## Installation

```bash
git clone https://github.com/marinoscar/db2snow.git
cd db2snow
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
db2snow
```

## Quick Start

1. Launch the interactive menu:

   ```bash
   db2snow
   ```

2. Select **Initialize config** to set up encryption. Choose local (project) or global (home directory) config, then auto-generate a key or enter a passphrase.

3. Select **Map source schema** to connect to a database. Choose a source engine (PostgreSQL, MySQL, or SQL Server), then pick a saved connection or enter new details. After connecting, select schemas and tables. The mapping (with encrypted password) is saved to `.db2snow/mappings/`.

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

When mapping a schema, the tool checks for saved connections for the selected engine:

- If saved connections exist, you can pick one or create a new connection
- Saved connections store engine type, host, port, database, user, encrypted password, and SSL settings
- SQL Server connections can also store instance name and certificate trust settings
- After successfully connecting with new credentials, you'll be prompted to save the connection
- Connection files are stored in `.db2snow/connections/`

## CLI Options

| Option | Description |
|--------|-------------|
| `--version`, `-V` | Show version |
| `--help`, `-h` | Show help |

Running `db2snow` with no arguments launches the interactive menu.

## Type Mapping

Each source engine has its own type mapper that converts native types to Snowflake equivalents.

### PostgreSQL

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
| `boolean` | `BOOLEAN` | |
| `timestamp` | `TIMESTAMP_NTZ` | |
| `timestamptz` | `TIMESTAMP_TZ` | |
| `json` / `jsonb` | `VARIANT` | |
| `uuid` | `VARCHAR(36)` | |
| Array types (`_int4`, etc.) | `ARRAY` | Comment notes base type |

### MySQL

| MySQL | Snowflake | Notes |
|-------|-----------|-------|
| `int` / `integer` | `INTEGER` | |
| `bigint` | `BIGINT` | |
| `decimal(p,s)` | `NUMBER(p,s)` | Precision preserved |
| `float` | `FLOAT` | |
| `double` | `DOUBLE` | |
| `varchar(n)` | `VARCHAR(n)` | |
| `text` / `longtext` | `VARCHAR` | |
| `boolean` / `bool` | `BOOLEAN` | |
| `datetime` | `TIMESTAMP_NTZ` | |
| `timestamp` | `TIMESTAMP_TZ` | |
| `json` | `VARIANT` | |
| `blob` / `binary` | `BINARY` | |
| `enum` / `set` | `VARCHAR` | Comment notes values |

### SQL Server

| SQL Server | Snowflake | Notes |
|------------|-----------|-------|
| `int` | `INTEGER` | |
| `bigint` | `BIGINT` | |
| `decimal(p,s)` / `numeric(p,s)` | `NUMBER(p,s)` | Precision preserved |
| `float` | `FLOAT` | |
| `money` | `NUMBER(19,4)` | |
| `nvarchar(n)` / `varchar(n)` | `VARCHAR(n)` | |
| `ntext` / `text` | `VARCHAR` | |
| `bit` | `BOOLEAN` | |
| `datetime2` | `TIMESTAMP_NTZ` | |
| `datetimeoffset` | `TIMESTAMP_TZ` | |
| `uniqueidentifier` | `VARCHAR(36)` | |
| `xml` | `VARCHAR` | |
| `sql_variant` | `VARIANT` | |

## Configuration

The `.db2snow/` directory contains:

```
.db2snow/
  key                  # AES-256-GCM encryption key (hex)
  aws.json             # AWS credentials (secret key encrypted)
  mappings/            # Mapping JSON files
  connections/         # Saved connection files
  logs/                # Session log files
```

Config is resolved in order: local (`./.db2snow/`) then global (`~/.db2snow/`).

**Important:** The `key` file contains your encryption key. Do not commit it to version control. If using local config, add `.db2snow/` to your `.gitignore` (already included by default).

## Project Structure

```
src/
  index.ts                          # Entry point (--version, --help, launches menu)
  menu.ts                           # Interactive menu loop
  constants.ts                      # App-wide constants
  types/                            # TypeScript interfaces
    source-engine.ts                # SourceEngine union type + connection config
    config.ts, postgres.ts, mapping.ts, snowflake.ts, export.ts, connection.ts, aws.ts
  services/                         # Core business logic
    source-adapter.ts               # Base adapter interface for all engines
    adapter-factory.ts              # Factory to get engine-specific adapter
    adapters/                       # Engine-specific adapter implementations
      postgres.adapter.ts
      mysql.adapter.ts
      mssql.adapter.ts
    encryption.service.ts           # AES-256-GCM encrypt/decrypt
    config.service.ts               # Config directory + key management
    connection.service.ts           # Saved connection CRUD
    aws.service.ts                  # AWS credentials + S3 upload
    postgres.service.ts             # PG connection + schema introspection
    mapping.service.ts              # Mapping file read/write
    type-mapper.service.ts          # PostgreSQL -> Snowflake type mapping
    mysql-type-mapper.ts            # MySQL -> Snowflake type mapping
    mssql-type-mapper.ts            # SQL Server -> Snowflake type mapping
    ddl-generator.service.ts        # Snowflake DDL generation
    duckdb-export.service.ts        # DuckDB-based Parquet/CSV export
  commands/                         # CLI command handlers
    init.command.ts, map.command.ts, export.command.ts, generate-ddl.command.ts, upload.command.ts
  ui/                               # Terminal UI (chalk, ora, boxen, cli-table3)
    theme.ts, spinner.ts, prompts.ts, logger.ts, display.ts
  utils/                            # Helpers
    error.ts, file.ts, validation.ts, log-file.ts
    pg-queries.ts, mysql-queries.ts, mssql-queries.ts
tests/
  services/                         # Unit tests for services
  utils/                            # Unit tests for utilities
docs/
  COMMANDS.md                       # Detailed command reference
  TROUBLESHOOTING.md                # Troubleshooting guide
```

## Troubleshooting

- **Log files**: check `.db2snow/logs/` for detailed session logs
- **Verbose mode**: select **Toggle verbose** from the menu to enable debug-level console output
- **Connection issues**: verify host, port, and credentials; check firewall rules and database access configuration
- **DuckDB errors**: ensure the `@duckdb/node-api` package installed correctly for your platform
- **Encryption key errors**: make sure `.db2snow/key` exists and matches the key used when mapping was created

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
