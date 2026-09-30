/**
 * Storage Service
 * Handles upload/serve/delete via provider abstraction.
 */

import crypto from 'crypto';
import path from 'path';
import {
  storageProvider,
  StorageBucket,
  ALLOWED_AUDIO_MIME,
  ALLOWED_IMAGE_MIME,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
} from './storage.provider.js';

export class StorageService {
  /**
   * Upload an audio file. Returns provider URL + metadata.
   */
  async uploadAudio(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    fileSize: number
  ) {
    if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
      throw new Error(`Unsupported audio format: ${mimeType}`);
    }
    if (fileSize > MAX_AUDIO_SIZE_BYTES) {
      throw new Error(`File too large. Maximum audio size is 200 MB.`);
    }

    const ext = this.getExtFromMime(mimeType) || path.extname(originalName) || '.mp3';
    const key = `${crypto.randomUUID()}${ext}`;
    return storageProvider.upload('audio', key, buffer, mimeType, fileSize);
  }

  /**
   * Upload artwork. Returns provider URL + metadata.
   */
  async uploadArtwork(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    fileSize: number
  ) {
    if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
      throw new Error(`Unsupported image format: ${mimeType}`);
    }
    if (fileSize > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large. Maximum artwork size is 20 MB.`);
    }

    const ext = this.getExtFromMime(mimeType) || path.extname(originalName) || '.jpg';
    const key = `${crypto.randomUUID()}${ext}`;
    return storageProvider.upload('artwork', key, buffer, mimeType, fileSize);
  }

  async getSignedUrl(bucket: StorageBucket, key: string, expiresInSeconds = 3600) {
    return storageProvider.getSignedUrl(bucket, key, expiresInSeconds);
  }

  async deleteFile(bucket: StorageBucket, key: string) {
    return storageProvider.delete(bucket, key);
  }

  getPublicUrl(bucket: StorageBucket, key: string) {
    return storageProvider.getPublicUrl(bucket, key);
  }

  private getExtFromMime(mime: string): string {
    const map: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/flac': '.flac',
      'audio/x-flac': '.flac',
      'audio/aac': '.aac',
      'audio/webm': '.webm',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mime] || '';
  }
}

export const storageService = new StorageService();
