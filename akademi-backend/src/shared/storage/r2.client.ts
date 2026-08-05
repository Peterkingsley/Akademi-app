import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../../config/env';

const accountId = config.r2AccountId?.trim() || 'placeholder-account-id';

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey || 'dummy_access_key',
    secretAccessKey: config.r2SecretKey || 'dummy_secret_key',
  },
  forcePathStyle: true,
});
