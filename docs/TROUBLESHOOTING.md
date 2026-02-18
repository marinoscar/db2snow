# Troubleshooting

## Log Files

Session logs are written to `.pgtosnowflake/logs/`. Each session creates a new log file:

```
.pgtosnowflake/logs/pgtosnowflake-2026-02-17T12-00-00-000Z.log
```

Log entries include timestamps, levels, and context:

```
[2026-02-17T12:00:00.123Z] [INFO] [map] Connected to PostgreSQL at localhost:5432/mydb
[2026-02-17T12:00:01.456Z] [ERROR] [export] Failed to export public.large_table
  Error: timeout exceeded
  Stack: ...
```

Only the last 10 log files are kept. Older files are automatically deleted.

## Verbose Mode

Enable verbose mode for debug-level output in the console by selecting **Toggle verbose** from the interactive menu.

## Common Issues

### Configuration not found

```
Configuration not found. Run "init" first.
```

Select **Initialize config** from the menu to create the `.pgtosnowflake/` directory.

Config is searched in order:
1. `./.pgtosnowflake/` (current directory)
2. `~/.pgtosnowflake/` (home directory)

### PostgreSQL connection refused

```
Failed to connect to PostgreSQL at localhost:5432/mydb
```

- Verify PostgreSQL is running
- Check host, port, database name, username, and password
- Ensure `pg_hba.conf` allows connections from your client IP
- If using SSL, enable SSL when prompted during connection setup

### Password decryption failed

```
Failed to decrypt data. Check your encryption key.
```

The encryption key in `.pgtosnowflake/key` must match the key used when the mapping was created. If you regenerated the key with init, existing mappings cannot be decrypted. You'll need to re-run the map action to create a new mapping with the new key.

### DuckDB extension installation issues

```
Failed to install postgres extension
```

- Ensure your system has internet access (DuckDB downloads extensions on first use)
- Check that `@duckdb/node-api` installed correctly: `npm ls @duckdb/node-api`
- On Windows, ensure you're using a supported Node.js version (20+)
- Try deleting `node_modules` and running `npm install` again

### Large table export timeouts

For very large tables, the export may take a long time. DuckDB processes each table sequentially. There is no built-in timeout, but you can:

- Filter tables during export to process specific ones
- Monitor progress via the spinner or verbose logs
- Check the output directory for partially written files

### No mapping files found

```
No mapping files found. Run "map" first to create one.
```

Select **Map PostgreSQL schema** from the menu to connect to PostgreSQL and create a mapping. Mapping files are stored in `.pgtosnowflake/mappings/`.

### Permission denied errors

- On Linux/macOS, ensure you have write permissions to the config directory
- For global config (`~/.pgtosnowflake/`), check home directory permissions
- For local config (`./.pgtosnowflake/`), check current directory permissions

### Saved connection file errors

```
Failed to load connection: <name>
```

- Verify the connection file exists in `.pgtosnowflake/connections/`
- Ensure the encryption key matches the one used when the connection was saved
- If the key was regenerated, saved connections must be re-created

### Connection file not found

If the `connections/` directory doesn't exist (older config), it will be created automatically when you first save a connection. You can also re-run **Initialize config** to create the directory.

### AWS credentials not configured

```
AWS credentials not configured.
```

AWS credentials are optional and can be configured in two ways:
- During init: answer "Yes" when asked to configure AWS credentials
- During upload: the upload command will offer to configure credentials inline

### S3 bucket not found or access denied

```
Bucket "my-bucket" not found or access denied
```

- Verify the bucket name is correct
- Ensure your AWS credentials have `s3:HeadBucket` and `s3:PutObject` permissions
- Check the bucket's region matches the region in your AWS credentials
- Verify the bucket exists in the AWS Console

### S3 upload timeout

If uploads are timing out for large files:
- Check your network connection
- The tool uses multipart uploads (via `@aws-sdk/lib-storage`) for files >5MB
- Monitor progress bars — if progress stalls, press Ctrl+C and retry
- Check `.pgtosnowflake/logs/` for detailed error messages

### AWS credential decryption failed

```
Failed to decrypt AWS credentials. Check your encryption key.
```

The encryption key in `.pgtosnowflake/key` must match the key used when AWS credentials were saved. If you regenerated the key with init, you'll need to reconfigure AWS credentials.

### ESC key not working

The ESC key sends the `escape` keypress event to go back. If ESC is not responding:

- Ensure your terminal supports keypress events (most modern terminals do)
- On Windows, use Windows Terminal or PowerShell (not legacy cmd.exe)
- SSH sessions may intercept ESC — try pressing ESC twice quickly
- Some terminal multiplexers (tmux, screen) may require ESC prefix configuration

## Resetting Configuration

To start fresh, delete the config directory:

```bash
# Local config
rm -rf .pgtosnowflake/

# Global config
rm -rf ~/.pgtosnowflake/
```

Then select **Initialize config** from the menu to set up a new encryption key.

**Warning**: Deleting the config directory removes the encryption key. Any existing mapping files and saved connections will no longer be decryptable.
