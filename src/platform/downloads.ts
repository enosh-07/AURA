/**
 * AURA DownloadManager — Platform Abstraction
 * =============================================
 * Manages offline track downloads across:
 *   - Web:     IndexedDB (via idb-keyval) — stores audio blob
 *   - Android: Capacitor Filesystem (external storage) + IndexedDB metadata
 *   - iOS:     Capacitor Filesystem (app documents dir) + IndexedDB metadata
 *   - Desktop: Tauri filesystem (app data dir) + IndexedDB metadata
 *
 * Legal note: Only allow downloads for tracks AURA is legally permitted
 * to store offline. Licensing enforcement must happen on the backend.
 * This module trusts that the backend has already verified eligibility.
 */

import { PLATFORM, isCapacitor, isTauri } from './platform';
import { writeDownloadedFile, deleteLocalFile } from './filesystem';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'complete'
  | 'failed'
  | 'paused'
  | 'removed';

export interface DownloadRecord {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  artwork: string;
  status: DownloadStatus;
  progress: number;           // 0.0 – 1.0
  localPath: string | null;   // blob: or native path
  qualityTier: string;
  fileSizeBytes: number;
  downloadedAt: number;       // Unix timestamp ms
  expiresAt: number | null;   // null = no expiry
}

// ---------------------------------------------------------------------------
// IDB key helpers
// ---------------------------------------------------------------------------

const IDB_PREFIX = 'aura_download_';
const toKey = (trackId: string) => `${IDB_PREFIX}${trackId}`;
const fromKey = (key: string) => key.replace(IDB_PREFIX, '');

// ---------------------------------------------------------------------------
// Internal — load/save record
// ---------------------------------------------------------------------------

async function loadRecord(trackId: string): Promise<DownloadRecord | null> {
  const result = await idbGet<DownloadRecord>(toKey(trackId));
  return result ?? null;
}

async function saveRecord(record: DownloadRecord): Promise<void> {
  await idbSet(toKey(record.trackId), record);
}

async function deleteRecord(trackId: string): Promise<void> {
  await idbDel(toKey(trackId));
}

// ---------------------------------------------------------------------------
// Internal download implementation (extracted so resumeDownload can call it)
// ---------------------------------------------------------------------------

async function _downloadTrack(
  trackId: string,
  audioUrl: string,
  meta: { title: string; artist: string; artwork: string; qualityTier?: string }
): Promise<void> {
  const existing = await loadRecord(trackId);
  if (existing?.status === 'complete') return;

  const record: DownloadRecord = {
    trackId,
    trackTitle: meta.title,
    trackArtist: meta.artist,
    artwork: meta.artwork,
    status: 'downloading',
    progress: 0,
    localPath: null,
    qualityTier: meta.qualityTier ?? 'standard',
    fileSizeBytes: 0,
    downloadedAt: Date.now(),
    expiresAt: null,
  };

  await saveRecord(record);

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const total = Number(response.headers.get('Content-Length') ?? 0);
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const progress = total > 0 ? received / total : 0;
      await saveRecord({ ...record, status: 'downloading', progress, fileSizeBytes: received });
    }

    const data = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    let localPath: string;
    const filename = `${trackId}.audio`;

    if (isTauri || isCapacitor) {
      localPath = await writeDownloadedFile({ filename, data, directory: 'downloads' });
    } else {
      const blob = new Blob([data], { type: 'audio/mpeg' });
      await idbSet(`aura_blob_${trackId}`, blob);
      localPath = `idb:${trackId}`;
    }

    await saveRecord({
      ...record,
      status: 'complete',
      progress: 1,
      localPath,
      fileSizeBytes: received,
      downloadedAt: Date.now(),
    });
  } catch (err) {
    await saveRecord({ ...record, status: 'failed', progress: 0 });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DownloadManager — public API
// ---------------------------------------------------------------------------

export const DownloadManager = {
  // ---- downloadTrack -------------------------------------------------------

  async downloadTrack(
    trackId: string,
    audioUrl: string,
    meta: { title: string; artist: string; artwork: string; qualityTier?: string }
  ): Promise<void> {
    return _downloadTrack(trackId, audioUrl, meta);
  },

  // ---- pauseDownload -------------------------------------------------------

  async pauseDownload(trackId: string): Promise<void> {
    const record = await loadRecord(trackId);
    if (!record || record.status !== 'downloading') return;
    await saveRecord({ ...record, status: 'paused' });
    // Note: fetch streams cannot be paused natively — implement with AbortController in a future version
  },

  // ---- resumeDownload -------------------------------------------------------

  async resumeDownload(
    trackId: string,
    audioUrl: string,
    meta: { title: string; artist: string; artwork: string; qualityTier?: string }
  ): Promise<void> {
    const record = await loadRecord(trackId);
    if (!record || record.status === 'complete') return;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    await _downloadTrack(trackId, audioUrl, meta);
  },

  // ---- cancelDownload -------------------------------------------------------

  async cancelDownload(trackId: string): Promise<void> {
    const record = await loadRecord(trackId);
    if (!record) return;
    if (record.localPath) await _cleanupFile(trackId, record.localPath);
    await deleteRecord(trackId);
  },

  // ---- deleteDownload -------------------------------------------------------

  async deleteDownload(trackId: string): Promise<void> {
    const record = await loadRecord(trackId);
    if (!record) return;
    if (record.localPath) await _cleanupFile(trackId, record.localPath);
    await deleteRecord(trackId);
  },

  // ---- getDownloadStatus ---------------------------------------------------

  async getDownloadStatus(trackId: string): Promise<DownloadRecord | null> {
    return loadRecord(trackId);
  },

  // ---- getOfflineTracks ---------------------------------------------------

  async getOfflineTracks(): Promise<DownloadRecord[]> {
    const allKeys = await idbKeys() as string[];
    const downloadKeys = allKeys.filter((k) => String(k).startsWith(IDB_PREFIX));
    const records = await Promise.all(downloadKeys.map((k) => idbGet<DownloadRecord>(k)));
    return (records.filter(Boolean) as DownloadRecord[]).filter((r) => r.status === 'complete');
  },

  // ---- getBlobUrl for a downloaded track ----------------------------------

  async getLocalPlaybackUrl(trackId: string): Promise<string | null> {
    const record = await loadRecord(trackId);
    if (!record || record.status !== 'complete' || !record.localPath) return null;

    if (record.localPath.startsWith('idb:')) {
      const blob = await idbGet<Blob>(`aura_blob_${trackId}`);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    }

    // Native path — return as-is; Capacitor/Tauri can resolve it
    return record.localPath;
  },
};

// ---------------------------------------------------------------------------
// Internal cleanup helper
// ---------------------------------------------------------------------------

async function _cleanupFile(trackId: string, localPath: string): Promise<void> {
  if (localPath.startsWith('idb:')) {
    await idbDel(`aura_blob_${trackId}`);
    return;
  }
  if (localPath.startsWith('blob:')) {
    URL.revokeObjectURL(localPath);
    return;
  }
  await deleteLocalFile(localPath).catch(() => {});
}
