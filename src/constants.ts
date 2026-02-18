export const APP_NAME = 'pgtosnowflake';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'PostgreSQL to Snowflake migration tool';

export const CONFIG_DIR_NAME = '.pgtosnowflake';
export const MAPPINGS_DIR_NAME = 'mappings';
export const LOGS_DIR_NAME = 'logs';
export const KEY_FILE_NAME = 'key';
export const MAPPING_FILE_EXTENSION = '.mapping.json';
export const CONNECTIONS_DIR_NAME = 'connections';
export const CONNECTION_FILE_EXTENSION = '.connection.json';

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const SCRYPT_KEY_LENGTH = 32;
export const SCRYPT_SALT = 'pgtosnowflake-salt';

export const MAX_LOG_FILES = 10;

export const SYSTEM_SCHEMAS = [
  'pg_catalog',
  'information_schema',
  'pg_toast',
  'pg_temp_1',
  'pg_toast_temp_1',
];

export const DEFAULT_PG_PORT = 5432;
export const DEFAULT_EXPORT_FORMAT = 'parquet' as const;
export const DEFAULT_OUTPUT_DIR = './export';

export const MAPPING_FILE_VERSION = 1;

export const AWS_CREDENTIALS_FILE_NAME = 'aws.json';
export const DEFAULT_AWS_REGION = 'us-east-1';
