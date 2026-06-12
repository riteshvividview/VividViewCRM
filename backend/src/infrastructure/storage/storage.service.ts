import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { AppConfigService } from '@config/config.service';
import { STORAGE_CATEGORIES } from '@common/constants';

export type StorageCategory = (typeof STORAGE_CATEGORIES)[keyof typeof STORAGE_CATEGORIES];

export interface UploadResult {
  fileKey: string;
  fileUrl: string;
  fileMimeType: string;
  fileSizeBytes: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // TODO: Make s3 non-nullable when implementing file uploads — remove the null branch and
  // ensure R2_* env vars are set. See config.service.ts r2IsConfigured getter.
  private readonly s3: S3Client | null;

  constructor(private readonly config: AppConfigService) {
    if (config.r2IsConfigured) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: config.r2Endpoint,
        credentials: {
          accessKeyId: config.r2AccessKeyId,
          secretAccessKey: config.r2SecretAccessKey,
        },
      });
      this.logger.log('R2 storage initialised');
    } else {
      this.s3 = null;
      // TODO: Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
      // R2_ENDPOINT in .env when implementing file uploads (Invoice PDFs, HRMS docs, avatars).
      this.logger.warn('R2 storage not configured — file upload operations disabled');
    }
  }

  /**
   * Build a storage key for an object.
   * Pattern: {workspaceId}/{category}/{year}/{month}/{uuid}.{ext}
   */
  buildKey(
    workspaceId: string,
    category: StorageCategory,
    filename: string,
  ): string {
    const ext = filename.split('.').pop() ?? 'bin';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${workspaceId}/${category}/${year}/${month}/${randomUUID()}.${ext}`;
  }

  /**
   * Upload a buffer to R2/S3.
   * Returns the file key and public URL (if bucket is public) or the key for signed URLs.
   */
  async upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadResult> {
    if (!this.s3) {
      throw new Error('File storage is not configured. Set R2_* environment variables to enable uploads.');
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    const fileUrl = this.config.r2PublicUrl
      ? `${this.config.r2PublicUrl}/${key}`
      : await this.getSignedUrl(key);

    return {
      fileKey: key,
      fileUrl,
      fileMimeType: mimeType,
      fileSizeBytes: buffer.byteLength,
    };
  }

  /**
   * Generate a pre-signed GET URL for a private object.
   * Default TTL is R2_SIGNED_URL_EXPIRY (300 seconds).
   */
  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    if (!this.s3) {
      throw new Error('File storage is not configured. Set R2_* environment variables to enable signed URLs.');
    }
    const expiry = expiresInSeconds ?? this.config.r2SignedUrlExpiry;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.config.r2BucketName, Key: key }),
      { expiresIn: expiry },
    );
  }

  /**
   * Delete an object from storage.
   */
  async delete(key: string): Promise<void> {
    if (!this.s3) {
      throw new Error('File storage is not configured. Set R2_* environment variables to enable storage operations.');
    }
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.config.r2BucketName, Key: key }),
    );
    this.logger.log(`Deleted storage object: ${key}`);
  }

  /**
   * Check if an object exists without downloading it.
   */
  async exists(key: string): Promise<boolean> {
    if (!this.s3) return false;
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.config.r2BucketName, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Returns true when all required R2 credentials are present and the client is initialised. */
  isConfigured(): boolean {
    return this.s3 !== null;
  }
}
