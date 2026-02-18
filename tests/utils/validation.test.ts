import { describe, it, expect } from 'vitest';
import {
  isValidPort,
  isValidHost,
  isValidDatabaseName,
  isValidMappingName,
  isNonEmptyString,
  validatePortInput,
  validateHostInput,
  validateNonEmpty,
  validateMappingName,
  isValidS3BucketName,
  validateS3BucketName,
  isValidS3Prefix,
  validateS3Prefix,
} from '../../src/utils/validation.js';

describe('validation', () => {
  describe('isValidPort', () => {
    it('should accept valid ports', () => {
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(5432)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(1.5)).toBe(false);
    });
  });

  describe('isValidHost', () => {
    it('should accept valid hosts', () => {
      expect(isValidHost('localhost')).toBe(true);
      expect(isValidHost('127.0.0.1')).toBe(true);
      expect(isValidHost('my-host.example.com')).toBe(true);
      expect(isValidHost('db_server')).toBe(true);
    });

    it('should reject invalid hosts', () => {
      expect(isValidHost('')).toBe(false);
      expect(isValidHost('  ')).toBe(false);
      expect(isValidHost('host name with spaces')).toBe(false);
    });
  });

  describe('isValidDatabaseName', () => {
    it('should accept valid database names', () => {
      expect(isValidDatabaseName('mydb')).toBe(true);
      expect(isValidDatabaseName('my_db')).toBe(true);
      expect(isValidDatabaseName('my-db')).toBe(true);
      expect(isValidDatabaseName('_private')).toBe(true);
    });

    it('should reject invalid database names', () => {
      expect(isValidDatabaseName('')).toBe(false);
      expect(isValidDatabaseName('123db')).toBe(false);
      expect(isValidDatabaseName('my db')).toBe(false);
    });
  });

  describe('isValidMappingName', () => {
    it('should accept valid mapping names', () => {
      expect(isValidMappingName('my-project')).toBe(true);
      expect(isValidMappingName('project_v2')).toBe(true);
      expect(isValidMappingName('Test123')).toBe(true);
    });

    it('should reject invalid mapping names', () => {
      expect(isValidMappingName('')).toBe(false);
      expect(isValidMappingName('my project')).toBe(false);
      expect(isValidMappingName('project.v2')).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should accept non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' a ')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });
  });

  describe('validatePortInput', () => {
    it('should return true for valid port strings', () => {
      expect(validatePortInput('5432')).toBe(true);
      expect(validatePortInput('80')).toBe(true);
    });

    it('should return error message for invalid ports', () => {
      expect(validatePortInput('abc')).toBeTypeOf('string');
      expect(validatePortInput('0')).toBeTypeOf('string');
      expect(validatePortInput('99999')).toBeTypeOf('string');
    });
  });

  describe('validateHostInput', () => {
    it('should return true for valid hosts', () => {
      expect(validateHostInput('localhost')).toBe(true);
    });

    it('should return error for invalid hosts', () => {
      expect(validateHostInput('')).toBeTypeOf('string');
    });
  });

  describe('validateNonEmpty', () => {
    it('should return true for non-empty input', () => {
      expect(validateNonEmpty('test')).toBe(true);
    });

    it('should return error for empty input', () => {
      expect(validateNonEmpty('')).toBeTypeOf('string');
      expect(validateNonEmpty('  ')).toBeTypeOf('string');
    });
  });

  describe('validateMappingName', () => {
    it('should return true for valid names', () => {
      expect(validateMappingName('my-project')).toBe(true);
    });

    it('should return error for invalid names', () => {
      expect(validateMappingName('my project')).toBeTypeOf('string');
    });
  });

  describe('isValidS3BucketName', () => {
    it('should accept valid bucket names', () => {
      expect(isValidS3BucketName('my-bucket')).toBe(true);
      expect(isValidS3BucketName('my.bucket.name')).toBe(true);
      expect(isValidS3BucketName('abc')).toBe(true);
      expect(isValidS3BucketName('a-bucket-with-63-chars-' + 'x'.repeat(40))).toBe(true);
    });

    it('should reject names shorter than 3 characters', () => {
      expect(isValidS3BucketName('ab')).toBe(false);
      expect(isValidS3BucketName('a')).toBe(false);
      expect(isValidS3BucketName('')).toBe(false);
    });

    it('should reject names longer than 63 characters', () => {
      expect(isValidS3BucketName('a'.repeat(64))).toBe(false);
    });

    it('should reject uppercase characters', () => {
      expect(isValidS3BucketName('My-Bucket')).toBe(false);
      expect(isValidS3BucketName('BUCKET')).toBe(false);
    });

    it('should reject consecutive dots', () => {
      expect(isValidS3BucketName('my..bucket')).toBe(false);
    });

    it('should reject IP-formatted names', () => {
      expect(isValidS3BucketName('192.168.1.1')).toBe(false);
      expect(isValidS3BucketName('10.0.0.1')).toBe(false);
    });
  });

  describe('validateS3BucketName', () => {
    it('should return true for valid bucket names', () => {
      expect(validateS3BucketName('my-bucket')).toBe(true);
    });

    it('should return error string for invalid bucket names', () => {
      expect(validateS3BucketName('AB')).toBeTypeOf('string');
    });
  });

  describe('isValidS3Prefix', () => {
    it('should accept valid prefixes', () => {
      expect(isValidS3Prefix('')).toBe(true);
      expect(isValidS3Prefix('data')).toBe(true);
      expect(isValidS3Prefix('data/exports')).toBe(true);
      expect(isValidS3Prefix('data/exports/')).toBe(true);
    });

    it('should reject prefixes starting with /', () => {
      expect(isValidS3Prefix('/data')).toBe(false);
      expect(isValidS3Prefix('/data/exports')).toBe(false);
    });

    it('should reject prefixes with consecutive slashes', () => {
      expect(isValidS3Prefix('data//exports')).toBe(false);
    });
  });

  describe('validateS3Prefix', () => {
    it('should return true for valid prefixes', () => {
      expect(validateS3Prefix('data/exports')).toBe(true);
    });

    it('should return error string for invalid prefixes', () => {
      expect(validateS3Prefix('/data')).toBeTypeOf('string');
    });
  });
});
