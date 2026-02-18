export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidHost(host: string): boolean {
  if (!host || host.trim().length === 0) return false;
  // Allow hostnames, IPs, and localhost
  const hostRegex = /^[a-zA-Z0-9._-]+$/;
  return hostRegex.test(host);
}

export function isValidDatabaseName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  const dbRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  return dbRegex.test(name);
}

export function isValidMappingName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  return nameRegex.test(name);
}

export function isNonEmptyString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validatePortInput(input: string): string | true {
  const port = parseInt(input, 10);
  if (isNaN(port) || !isValidPort(port)) {
    return 'Please enter a valid port number (1-65535)';
  }
  return true;
}

export function validateHostInput(input: string): string | true {
  if (!isValidHost(input)) {
    return 'Please enter a valid hostname or IP address';
  }
  return true;
}

export function validateNonEmpty(input: string): string | true {
  if (!isNonEmptyString(input)) {
    return 'This field cannot be empty';
  }
  return true;
}

export function validateMappingName(input: string): string | true {
  if (!isValidMappingName(input)) {
    return 'Name must contain only letters, numbers, hyphens, and underscores';
  }
  return true;
}

export function isValidS3BucketName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 63) return false;
  // Must be lowercase alphanumeric, hyphens, and dots only
  if (!/^[a-z0-9][a-z0-9.\-]*[a-z0-9]$/.test(name)) return false;
  // No consecutive dots
  if (/\.\./.test(name)) return false;
  // Must not be formatted as an IP address
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return false;
  return true;
}

export function validateS3BucketName(input: string): string | true {
  if (!isValidS3BucketName(input)) {
    return 'Bucket name must be 3-63 characters, lowercase alphanumeric/hyphens/dots, not an IP address';
  }
  return true;
}

export function isValidS3Prefix(prefix: string): boolean {
  if (prefix.startsWith('/')) return false;
  if (prefix.includes('//')) return false;
  return true;
}

export function validateS3Prefix(input: string): string | true {
  if (!isValidS3Prefix(input)) {
    return 'S3 prefix must not start with "/" or contain "//"';
  }
  return true;
}
