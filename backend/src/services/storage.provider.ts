/**
 * Storage Provider Abstraction
 * Supports: local filesystem (default), S3-compatible, Supabase Storage
 * Never expose provider credentials to the frontend.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

export type StorageProviderType = 'local' | 's3' | 'supabase';
export type StorageBucket = 'audio' | 'artwork';

export interface IStorageProvider {
  upload(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<UploadResult>;

  getSignedUrl(bucket: StorageBucket, key: string, expiresInSeconds?: number): Promise<string>;
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
    };
  }

  async getSignedUrl(bucket: StorageBucket, key: string, _expiresInSeconds = 3600): Promise<string> {
    // For local storage, signed URLs are just a token-protected endpoint
    const token = crypto
      .createHmac('sha256', ENV.JWT_ACCESS_SECRET)
      .update(`${bucket}:${key}`)
      .digest('hex')
      .slice(0, 16);
    return `${this.baseUrl}/${bucket}/${key}?token=${token}`;
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
// S3-COMPATIBLE PROVIDER STUB
// Activate by setting STORAGE_PROVIDER=s3 in .env
// Requires: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET_AUDIO, S3_BUCKET_ARTWORK
// ============================================================

class S3StorageProvider implements IStorageProvider {
  async upload(
    bucket: StorageBucket,
    key: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number
  ): Promise<UploadResult> {
    // TODO: Integrate @aws-sdk/client-s3 when cloud credentials are provided
    throw new Error('S3 provider not yet configured. Set STORAGE_PROVIDER=local or configure S3 credentials.');
  }

  async getSignedUrl(_bucket: StorageBucket, _key: string, _expiresInSeconds?: number): Promise<string> {
    throw new Error('S3 provider not configured.');
  }

  async delete(_bucket: StorageBucket, _key: string): Promise<void> {
    throw new Error('S3 provider not configured.');
  }

  getPublicUrl(_bucket: StorageBucket, _key: string): string {
    throw new Error('S3 provider not configured.');
  }
}

// ============================================================
// FACTORY — choose provider from env
// ============================================================

function createStorageProvider(): IStorageProvider {
  const providerType = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderType;
  switch (providerType) {
    case 's3':
      return new S3StorageProvider();
    case 'local':
    default:
      return new LocalStorageProvider();
  }
}

export const storageProvider = createStorageProvider();

// ============================================================
// ALLOWED MIME TYPES
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
