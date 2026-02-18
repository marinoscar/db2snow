# Command Reference

## Interactive Menu

Run `pgtosnowflake` with no arguments to launch the interactive menu:

```
? What would you like to do?
❯ 1. Initialize config         Set up encryption key and config directory
  2. Map PostgreSQL schema      Connect to PostgreSQL and create a schema mapping
  3. Export data                Export table data to Parquet or CSV via DuckDB
  4. Generate Snowflake DDL     Generate Snowflake DDL from a mapping file
  5. Upload to S3               Upload exported files to an S3 bucket
  6. Toggle verbose (OFF)       Enable/disable debug logging to console
  7. Exit                       Exit the application
```

Use arrow keys to navigate, or type a number to jump to an option. Press Enter to select.

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `ESC` | Any prompt | Go back to the previous level / return to main menu |
| `Ctrl+C` | Sub-command prompt | Cancel current action and return to menu |
| `Ctrl+C` ×2 | Main menu | Exit the application (press twice within 2 seconds) |
| Arrow keys | Menu / list | Navigate options |
| Space | Checkbox list | Toggle selection |
| Enter | Any prompt | Confirm selection |

A keyboard legend is displayed above the main menu prompt:

```
  ESC Back  |  Ctrl+C ×2 Exit
```

## Initialize Config

Sets up the `.pgtosnowflake/` configuration directory and encryption key.

### Flow

1. Choose config location: local (current directory) or global (home directory)
2. If config already exists, confirm overwrite
3. Choose key generation: auto-generate random 256-bit key or derive from passphrase
4. Creates `.pgtosnowflake/` with `key`, `mappings/`, `connections/`, and `logs/` subdirectories

### Notes

- For local config, add `.pgtosnowflake/` to `.gitignore` to protect your encryption key
- The encryption key is used for the `password` field in mapping files and saved connections

## Map PostgreSQL Schema

Connects to PostgreSQL, lets you interactively select schemas and tables, introspects metadata, and saves an encrypted mapping file.

### Flow

1. Verify config has been initialized
2. **Connection selection**:
   - If saved connections exist: choose a saved connection or "New connection"
   - Saved connection: loads host/port/user/SSL/password, prompts only for database (editable, defaults to saved value)
   - New connection: prompt for all fields (host, port, database, user, password, SSL)
3. Connect to PostgreSQL
4. **Save connection prompt**: after successful connection with new credentials, optionally save for future use
5. List schemas (checkbox selection, `public` pre-checked)
6. List tables per schema (checkbox selection, all pre-checked)
7. Introspect each selected table (columns, PKs, FKs, indexes, sequences)
8. Display summary table
9. Prompt for mapping name and default export format
10. Save mapping to `.pgtosnowflake/mappings/<name>.mapping.json`

### Saved Connections

Connection files are stored in `.pgtosnowflake/connections/<name>.connection.json` with the password encrypted using the same AES-256-GCM key as mapping files.

### Mapping File Structure

The mapping file is JSON with all fields in plaintext except the password:

```json
{
  "version": 1,
  "name": "my-project",
  "createdAt": "2026-02-17T...",
  "source": {
    "connection": {
      "host": "localhost",
      "port": 5432,
      "database": "mydb",
      "user": "postgres",
      "password": {
        "encrypted": true,
        "algorithm": "aes-256-gcm",
        "iv": "...",
        "tag": "...",
        "ciphertext": "..."
      },
      "ssl": false
    }
  },
  "selectedSchemas": ["public"],
  "tables": [...],
  "exportOptions": { "format": "parquet", "outputDir": "./export" }
}
```

## Export Data

Reads a mapping file and exports table data to Parquet or CSV using DuckDB.

### Flow

1. Load and decrypt mapping file
2. **Interactive table selection**:
   - For each schema, choose "All tables" or "Select specific tables..."
   - If selecting specific tables, a checkbox list shows all tables (pre-checked)
   - CLI `--tables` option bypasses interactive selection
3. Determine format (mapping default or prompt)
4. For each table, use DuckDB to `COPY` data from PostgreSQL
5. Display summary with row counts, durations, and file sizes

### Output

- Parquet files: ZSTD compressed, one file per table
- CSV files: with header row, one file per table
- File naming: `<schema>.<table>.<format>` (e.g., `public.users.parquet`)

## Generate Snowflake DDL

Reads a mapping file and generates Snowflake-compatible DDL.

### Flow

1. Load mapping file
2. Generate DDL with type mappings, PKs, FKs, identity columns
3. Show preview (schema count, table count, FK count)
4. Write to `.sql` file or stdout

### DDL Output Includes

- `CREATE SCHEMA IF NOT EXISTS` for each schema
- `CREATE TABLE IF NOT EXISTS` with columns, types, NOT NULL, DEFAULT, IDENTITY
- `PRIMARY KEY` inline in CREATE TABLE
- `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` after all tables
- Column comments for unmapped or special types
- Header comment noting Snowflake's declarative constraint behavior

## Upload to S3

Uploads exported Parquet/CSV files to an AWS S3 bucket with multipart upload support and progress tracking.

### Flow

1. Verify config has been initialized
2. Check for AWS credentials — if not configured, offer to set them up inline
3. Prompt for S3 bucket name (validated against S3 naming rules)
4. Verify bucket exists and is accessible (HeadBucket check)
5. Prompt for export directory (default: `./export`)
6. Scan for `.parquet` and `.csv` files, display file list with sizes
7. Choose to upload all files or select specific files via checkbox
8. Prompt for S3 key prefix (default: export directory name)
9. Upload files with per-file and overall progress bars
10. Display summary table with upload results

### S3 Key Structure

Files are uploaded with keys of the form:

```
<prefix>/<filename>
```

For example, with prefix `export` and file `public.users.parquet`:

```
s3://my-bucket/export/public.users.parquet
```

### Progress Display

```
  ████████████████░░░░░░░░░░░░░░ | 53% | public.users.parquet
  ██████████████████████████████ | 100% | Overall
```

### AWS Credentials

AWS credentials can be configured in two ways:
- During `init` (optional step after config creation)
- Inline when first running the upload command

Credentials are stored in `.pgtosnowflake/aws.json` with the secret access key encrypted using the same AES-256-GCM key as database passwords.

## Toggle Verbose

Toggles verbose debug logging on or off. When enabled, debug-level messages are printed to the console in addition to being written to log files. The current state is shown in the menu label.

## Type Mapping

| PostgreSQL | Snowflake | Notes |
|------------|-----------|-------|
| `int2` | `SMALLINT` | |
| `int4` / `serial` | `INTEGER` | serial → `IDENTITY(1,1)` |
| `int8` / `bigserial` | `BIGINT` | bigserial → `IDENTITY(1,1)` |
| `numeric(p,s)` | `NUMBER(p,s)` | |
| `varchar(n)` | `VARCHAR(n)` | |
| `text` | `VARCHAR` | |
| `boolean` | `BOOLEAN` | |
| `timestamp` | `TIMESTAMP_NTZ` | |
| `timestamptz` | `TIMESTAMP_TZ` | |
| `json` / `jsonb` | `VARIANT` | |
| `bytea` | `BINARY` | |
| `uuid` | `VARCHAR(36)` | |
| `interval` | `VARCHAR` | comment added |
| `_type` (arrays) | `ARRAY` | comment added |
| USER-DEFINED | `VARCHAR` | comment added |
