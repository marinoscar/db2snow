import { describe, it, expect } from 'vitest';
import { buildS3Key } from '../../src/services/aws.service.js';

describe('aws.service', () => {
  describe('buildS3Key', () => {
    it('should join prefix and filename with forward slash', () => {
      expect(buildS3Key('my-prefix', 'file.parquet')).toBe('my-prefix/file.parquet');
    });

    it('should handle prefix with trailing slash', () => {
      expect(buildS3Key('my-prefix/', 'file.parquet')).toBe('my-prefix/file.parquet');
    });

    it('should return just filename for empty prefix', () => {
      expect(buildS3Key('', 'file.parquet')).toBe('file.parquet');
    });

    it('should handle nested prefix', () => {
      expect(buildS3Key('data/exports/2024', 'public.users.parquet')).toBe('data/exports/2024/public.users.parquet');
    });

    it('should handle nested prefix with trailing slash', () => {
      expect(buildS3Key('data/exports/', 'file.csv')).toBe('data/exports/file.csv');
    });
  });
});
