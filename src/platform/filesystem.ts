/**
 * AURA Filesystem — Platform Abstraction
 * =========================================
 * Local file access and file picker across platforms:
 *   - Web:         File / FileReader API (no arbitrary FS access)
 *   - Android:     Capacitor Filesystem + FilePicker plugin
 *   - iOS:         Capacitor Filesystem + FilePicker plugin
 *   - Desktop:     Tauri file dialog + native FS access
 *
 * Only call these from feature modules (e.g. LocalMusicStudio).
 * Never import platform modules in generic components.
 */

import { PLATFORM, isCapacitor, isTauri, capabilities } from './platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalFile {
  name: string;
  path: string;           // native path on desktop/mobile; blob: URL on web
  mimeType: string;
  sizeBytes: number;
  /** Raw File object — only available on web */
  file?: File;
  /** Base64 data — populated by readFileAsBase64() */
  base64?: string;
}

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.flac', '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.aiff', '.alac',
];

export const SUPPORTED_AUDIO_MIMETYPES = [
  'audio/flac', 'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/wav', 'audio/ogg', 'audio/opus', 'audio/x-aiff',
];

// ---------------------------------------------------------------------------
// File Picker — opens OS file picker
// ---------------------------------------------------------------------------

export async function pickAudioFiles(): Promise<LocalFile[]> {
  if (!capabilities.filePicker) {
    throw new Error('File picker is not supported on this platform');
  }

  if (isTauri) return pickFilesDesktop();
  if (isCapacitor) return pickFilesMobile();
  return pickFilesWeb();
}

async function pickFilesWeb(): Promise<LocalFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = SUPPORTED_AUDIO_MIMETYPES.join(',');

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      const result: LocalFile[] = files.map((f) => ({
        name: f.name,
        path: URL.createObjectURL(f),
        mimeType: f.type,
        sizeBytes: f.size,
        file: f,
      }));
      resolve(result);
    };

    input.oncancel = () => resolve([]);

    // Some browsers do not fire oncancel
    const focusHandler = () => {
      window.removeEventListener('focus', focusHandler);
      setTimeout(() => {
        if (!input.files?.length) resolve([]);
      }, 300);
    };

    window.addEventListener('focus', focusHandler);
    input.click();
  });
}

async function pickFilesDesktop(): Promise<LocalFile[]> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Audio Files', extensions: ['flac','mp3','m4a','aac','wav','ogg','opus','aiff'] }],
    });

    if (!selected) return [];
    const paths = Array.isArray(selected) ? selected : [selected];

    return paths.map((p: string) => ({
      name: p.split(/[/\\]/).pop() ?? p,
      path: p,
      mimeType: getMimeFromExtension(p),
      sizeBytes: 0, // Tauri requires separate stat call
    }));
  } catch (err: any) {
    throw new Error(`Desktop file picker failed: ${err?.message ?? err}`);
  }
}

async function pickFilesMobile(): Promise<LocalFile[]> {
  try {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');
    const result = await FilePicker.pickFiles({
      types: ['audio/*'],
      limit: 0, // 0 = no limit (multiple files)
      readData: false,
    } as any);

    return result.files.map((f: any) => ({
      name: f.name,
      path: f.path ?? f.webPath ?? '',
      mimeType: f.mimeType ?? getMimeFromExtension(f.name),
      sizeBytes: f.size ?? 0,
    }));
  } catch (err: any) {
    throw new Error(`Mobile file picker failed: ${err?.message ?? err}`);
  }
}

// ---------------------------------------------------------------------------
// Read a local file as a Blob URL (for playback)
// ---------------------------------------------------------------------------

export async function readFileAsBlobUrl(localFile: LocalFile): Promise<string> {
  // Web — already a blob: URL
  if (localFile.path.startsWith('blob:') || localFile.path.startsWith('http')) {
    return localFile.path;
  }

  if (isTauri) {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(localFile.path);
    const blob = new Blob([bytes], { type: localFile.mimeType });
    return URL.createObjectURL(blob);
  }

  if (isCapacitor) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const result = await Filesystem.readFile({ path: localFile.path });
    const byteStr = atob(result.data as string);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const blob = new Blob([arr], { type: localFile.mimeType });
    return URL.createObjectURL(blob);
  }

  return localFile.path;
}

// ---------------------------------------------------------------------------
// Write a downloaded file to persistent local storage
// ---------------------------------------------------------------------------

export interface WriteFileOptions {
  filename: string;
  data: Uint8Array;
  directory?: string; // sub-directory within app data dir
}

export async function writeDownloadedFile(options: WriteFileOptions): Promise<string> {
  if (isTauri) {
    const { appDataDir } = await import('@tauri-apps/api/path');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const base = await appDataDir();
    const dir = options.directory ? await join(base, options.directory) : base;
    const fullPath = await join(dir, options.filename);
    await writeFile(fullPath, options.data);
    return fullPath;
  }

  if (isCapacitor) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = uint8ToBase64(options.data);
    const result = await Filesystem.writeFile({
      path: options.directory ? `${options.directory}/${options.filename}` : options.filename,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return result.uri;
  }

  // Web — cannot write to FS; caller should store in IndexedDB instead
  const blob = new Blob([options.data]);
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Delete a local file
// ---------------------------------------------------------------------------

export async function deleteLocalFile(path: string): Promise<void> {
  if (isTauri) {
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(path);
    return;
  }

  if (isCapacitor) {
    const { Filesystem } = await import('@capacitor/filesystem');
    await Filesystem.deleteFile({ path });
    return;
  }

  if (path.startsWith('blob:')) {
    URL.revokeObjectURL(path);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMimeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    aiff: 'audio/x-aiff',
  };
  return map[ext] ?? 'audio/mpeg';
}

function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Open file in system viewer (desktop)
// ---------------------------------------------------------------------------

export async function revealInFinder(path: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    // Open the containing directory
    const dir = path.replace(/[/\\][^/\\]+$/, '');
    await open(dir);
  } catch {
    // Non-critical
  }
}
