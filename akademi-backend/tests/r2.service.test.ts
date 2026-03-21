import { s3Client } from '../src/shared/storage/r2.client';
import * as r2Service from '../src/shared/storage/r2.service';
import * as r2Validation from '../src/shared/storage/r2.validation';
import * as r2Encryption from '../src/shared/storage/r2.encryption';
import crypto from 'crypto';

// Mock the S3Client and commands
jest.mock('../src/shared/storage/r2.client', () => ({
  s3Client: {
    send: jest.fn(),
  },
}));

// Mock the presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-signed-url.com'),
}));

// Mock prisma
jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    material: {
      findUnique: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
  },
}));

describe('R2 Storage Service', () => {
  describe('File Validation', () => {
    it('should validate allowed file types and sizes', () => {
      expect(() =>
        r2Validation.validateFile('application/pdf', 100 * 1024 * 1024, 'PDF'),
      ).not.toThrow();
    });

    it('should throw error for blocked file types', () => {
      expect(() =>
        r2Validation.validateFile('application/zip', 1024, 'PDF'),
      ).toThrow(r2Validation.FileValidationError);
    });

    it('should throw error for exceeding max size', () => {
      expect(() =>
        r2Validation.validateFile('application/pdf', 300 * 1024 * 1024, 'PDF'),
      ).toThrow(r2Validation.FileValidationError);
    });
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const data = Buffer.from('test data');
      const key = crypto.randomBytes(32);
      const encrypted = r2Encryption.encrypt(data, key);
      const decrypted = r2Encryption.decrypt(encrypted, key);
      expect(decrypted.toString()).toBe('test data');
    });
  });

  describe('Service Methods', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate a presigned URL', async () => {
      const url = await r2Service.generatePresignedUrl('test-key');
      expect(url).toBe('https://mock-signed-url.com');
    });

    it('should call s3Client.send on uploadFile', async () => {
      const key = 'test-file.txt';
      const buffer = Buffer.from('hello');
      const contentType = 'text/plain';

      await r2Service.uploadFile(key, buffer, contentType);
      expect(s3Client.send).toHaveBeenCalled();
    });

    it('should call s3Client.send twice on moveFile (copy and delete)', async () => {
      await r2Service.moveFile('source', 'dest');
      expect(s3Client.send).toHaveBeenCalledTimes(2);
    });

    it('should call s3Client.send on deleteFile', async () => {
      await r2Service.deleteFile('test-key');
      expect(s3Client.send).toHaveBeenCalled();
    });
  });
});
