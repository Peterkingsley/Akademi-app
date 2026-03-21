jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('mock data'))),
      },
    }),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  CopyObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));
