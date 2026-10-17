/**
 * Storage Provider Abstraction
 * Supports: Cloudflare R2 (S3-compatible, production), Local filesystem (development)
 * Never expose provider credentials to the frontend.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV } from '../config/env.js';

export interface UploadResult {
  id: string;
  url: string;
  provider: StorageProviderType;
  bucket: string;
  key: string;
  fileSize: number;
  mimeType: string;
  publicUrl?: string;
}

export interface StorageObject {
  id: string;
  url: string;
  provider: StorageProviderType;
  key: string;
  fileSize: number;
  mimeType: string;
}

export type StorageProviderType = 'local' | 'r2' | 's3' | 'supabase';
export type StorageBucket = 'audio' | 'artwork';

export interface PresignedUploadTicket {
  uploadUrl: string;
  objectKey: string;
  bucket: StorageBucket;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface IStorageProvider {
  upload(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<UploadResult>;

  getSignedUrl(bucket: StorageBucket, key: string, expiresInSeconds?: number): Promise<string>;
  getPresignedUploadUrl(bucket: StorageBucket, key: string, mimeType: string, expiresInSeconds?: number): Promise<PresignedUploadTicket>;
  delete(bucket: StorageBucket, key: string): Promise<void>;
  getPublicUrl(bucket: StorageBucket, key: string): string;
}

// ============================================================
// LOCAL FILE SYSTEM PROVIDER (default / development)
// ============================================================

class LocalStorageProvider implements IStorageProvider {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'storage');
    this.baseUrl = `${ENV.CLIENT_URL.replace(':3000', ':4000')}/api/v1/storage/serve`;
    this.ensureDirs();
  }

  private ensureDirs() {
    for (const bucket of ['audio', 'artwork'] as StorageBucket[]) {
      const dir = path.join(this.baseDir, bucket);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async upload(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<UploadResult> {
    const filePath = path.join(this.baseDir, bucket, key);
    await fs.promises.writeFile(filePath, buffer);

    return {
      id: key,
      url: this.getPublicUrl(bucket, key),
      provider: 'local',
      bucket,
      key,
      fileSize,
      mimeType,
      publicUrl: this.getPublicUrl(bucket, key),
    };
  }

  async getSignedUrl(bucket: StorageBucket, key: string, _expiresInSeconds = 3600): Promise<string> {
    const token = crypto
      .createHmac('sha256', ENV.JWT_ACCESS_SECRET)
      .update(`${bucket}:${key}`)
      .digest('hex')
      .slice(0, 16);
    return `${this.baseUrl}/${bucket}/${key}?token=${token}`;
  }

  async getPresignedUploadUrl(
    bucket: StorageBucket,
    key: string,
    _mimeType: string,
    expiresInSeconds = 900
  ): Promise<PresignedUploadTicket> {
    const publicUrl = this.getPublicUrl(bucket, key);
    return {
      uploadUrl: `/api/v1/storage/upload?bucket=${bucket}&key=${key}`,
      objectKey: key,
      bucket,
      publicUrl,
      expiresInSeconds,
    };
  }

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    const filePath = path.join(this.baseDir, bucket, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  getPublicUrl(bucket: StorageBucket, key: string): string {
    return `/api/v1/storage/serve/${bucket}/${key}`;
  }
}

// ============================================================
// CLOUDFLARE R2 / S3-COMPATIBLE STORAGE PROVIDER
// ============================================================

class R2StorageProvider implements IStorageProvider {
  private s3Client: S3Client;
  private audioBucket: string;
  private artworkBucket: string;
  private publicDomain: string;

  constructor() {
    const endpoint =
      ENV.R2_ENDPOINT ||
      (ENV.R2_ACCOUNT_ID ? `https://${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

    const accessKeyId = ENV.R2_ACCESS_KEY_ID || ENV.S3_ACCESS_KEY;
    const secretAccessKey = ENV.R2_SECRET_ACCESS_KEY || ENV.S3_SECRET_KEY;

    this.audioBucket = ENV.R2_BUCKET_AUDIO || 'aura-audio';
    this.artworkBucket = ENV.R2_BUCKET_ARTWORK || 'aura-artwork';
    this.publicDomain = ENV.R2_PUBLIC_DOMAIN ? ENV.R2_PUBLIC_DOMAIN.replace(/\/$/, '') : '';

    this.s3Client = new S3Client({
      region: ENV.S3_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  private resolveBucketName(bucket: StorageBucket): string {
    return bucket === 'audio' ? this.audioBucket : this.artworkBucket;
  }

  async upload(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<UploadResult> {
    const bucketName = this.resolveBucketName(bucket);
    const cacheControl = bucket === 'artwork'
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400, stale-while-revalidate=604800';

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: fileSize,
        CacheControl: cacheControl,
      })
    );

    const publicUrl = this.getPublicUrl(bucket, key);

    return {
      id: key,
      url: publicUrl,
      provider: 'r2',
      bucket: bucketName,
      key,
      fileSize,
      mimeType,
      publicUrl,
    };
  }

  async getSignedUrl(bucket: StorageBucket, key: string, expiresInSeconds = 3600): Promise<string> {
    const bucketName = this.resolveBucketName(bucket);
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return getS3SignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedUploadUrl(
    bucket: StorageBucket,
    key: string,
    mimeType: string,
    expiresInSeconds = 900
  ): Promise<PresignedUploadTicket> {
    const bucketName = this.resolveBucketName(bucket);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getS3SignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    const publicUrl = this.getPublicUrl(bucket, key);

    return {
      uploadUrl,
      objectKey: key,
      bucket,
      publicUrl,
      expiresInSeconds,
    };
  }

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    const bucketName = this.resolveBucketName(bucket);
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  }

  getPublicUrl(bucket: StorageBucket, key: string): string {
    const bucketName = this.resolveBucketName(bucket);
    if (this.publicDomain) {
      return `${this.publicDomain}/${bucketName}/${key}`;
    }
    // Fallback URL through API proxy if custom domain is not yet wired
    return `/api/v1/storage/serve/${bucket}/${key}`;
  }
}

// ============================================================
// FACTORY — choose provider from env
// ============================================================

function createStorageProvider(): IStorageProvider {
  const providerType = (process.env.STORAGE_PROVIDER || 'local').toLowerCase() as StorageProviderType;

  if (providerType === 'r2' || providerType === 's3') {
    const hasKeys = Boolean(
      (ENV.R2_ACCESS_KEY_ID || ENV.S3_ACCESS_KEY) &&
      (ENV.R2_SECRET_ACCESS_KEY || ENV.S3_SECRET_KEY)
    );

    if (hasKeys) {
      return new R2StorageProvider();
    } else {
      console.warn('⚠️  STORAGE_PROVIDER is set to R2/S3, but credentials are missing. Falling back to local storage.');
      return new LocalStorageProvider();
    }
  }

  return new LocalStorageProvider();
}

export const storageProvider = createStorageProvider();

// ============================================================
// ALLOWED MIME TYPES & SIZE CONSTRAINTS
// ============================================================

export const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/webm',
]);

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MAX_AUDIO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;  // 20 MB

