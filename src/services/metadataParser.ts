import { Track, QualityTier } from '../types/audio';

/**
 * Extracts average/dominant vibrant color from an image URL using canvas.
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('#00f2fe');

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          const brightness = (red + green + blue) / 3;
          if (brightness > 30 && brightness < 225) {
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }

        if (count === 0) return resolve('#00f2fe');
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve('#00f2fe');
      }
    };
    img.onerror = () => resolve('#00f2fe');
    img.src = imageUrl;
  });
}

/**
 * Robust Client-Side Audio Format & Metadata Parser
 * Supports: FLAC, WAV/PCM, ALAC/AAC, and MP3
 */
export async function parseAudioFile(file: File): Promise<Track> {
  // Read first 512KB for deep metadata and embedded artwork headers
  const headerSlice = await file.slice(0, 512 * 1024).arrayBuffer();
  const view = new DataView(headerSlice);

  let title = file.name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s\-_.]*/, '');
  let artist = 'Local Artist';
  let album = 'Local Audio Vault';
  let genre = 'Unassigned';
  let artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80';
  let year = new Date().getFullYear();

  // Technical Audio Metadata
  let codec = 'UNKNOWN';
  let container = 'UNKNOWN';
  let bitDepth: number | undefined = undefined;
  let sampleRate = 44100;
  let channels = 2;
  let bitrate = 0;
  let isLossless = false;
  let isGenuineLossless = false;
  let qualityTier: QualityTier = 'STANDARD';
  let duration = 0;

  const fileName = file.name.toLowerCase();

  // =========================================================================
  // 1. FLAC DECODER & METADATA PARSER
  // =========================================================================
  if (
    headerSlice.byteLength > 4 &&
    String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) === 'fLaC'
  ) {
    codec = 'FLAC';
    container = 'FLAC';
    isLossless = true;
    isGenuineLossless = true;

    let offset = 4;
    let isLastBlock = false;

    while (offset < headerSlice.byteLength - 4 && !isLastBlock) {
      const headerByte = view.getUint8(offset);
      isLastBlock = (headerByte & 0x80) !== 0;
      const blockType = headerByte & 0x7f;
      const blockLength = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
      offset += 4;

      if (offset + blockLength > headerSlice.byteLength) break;

      // Block 0: STREAMINFO
      if (blockType === 0 && blockLength >= 34) {
        // Bytes 10-17 contain sample rate (20 bits), channels (3 bits), bits per sample (5 bits), total samples (36 bits)
        const b10 = view.getUint8(offset + 10);
        const b11 = view.getUint8(offset + 11);
        const b12 = view.getUint8(offset + 12);
        const b13 = view.getUint8(offset + 13);
        const b14 = view.getUint8(offset + 14);
        const b15 = view.getUint8(offset + 15);
        const b16 = view.getUint8(offset + 16);
        const b17 = view.getUint8(offset + 17);

        sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
        channels = ((b12 >> 1) & 0x07) + 1;
        bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;

        const totalSamplesHi = b13 & 0x0f;
        const totalSamplesLo = (b14 << 24) | (b15 << 16) | (b16 << 8) | b17;
        const totalSamples = totalSamplesHi * 0x100000000 + totalSamplesLo;

        if (sampleRate > 0 && totalSamples > 0) {
          duration = Math.round(totalSamples / sampleRate);
        }

        // Calculate approximate bitrate
        if (duration > 0) {
          bitrate = Math.round((file.size * 8) / (duration * 1000));
        } else {
          bitrate = Math.round((sampleRate * channels * bitDepth * 0.6) / 1000); // ~60% FLAC compression ratio
        }
      }

      // Block 4: VORBIS_COMMENT
      else if (blockType === 4) {
        try {
          const commentView = new DataView(headerSlice, offset, blockLength);
          let cOffset = 0;
          const vendorLength = commentView.getUint32(cOffset, true);
          cOffset += 4 + vendorLength;

          if (cOffset < blockLength) {
            const userCommentCount = commentView.getUint32(cOffset, true);
            cOffset += 4;

            const decoder = new TextDecoder('utf-8');
            for (let i = 0; i < Math.min(userCommentCount, 50); i++) {
              if (cOffset + 4 > blockLength) break;
              const commentLen = commentView.getUint32(cOffset, true);
              cOffset += 4;
              if (cOffset + commentLen > blockLength) break;

              const comment = decoder.decode(new Uint8Array(headerSlice, offset + cOffset, commentLen));
              cOffset += commentLen;

              const eqIdx = comment.indexOf('=');
              if (eqIdx !== -1) {
                const key = comment.slice(0, eqIdx).toUpperCase();
                const val = comment.slice(eqIdx + 1).trim();
                if (key === 'TITLE' && val) title = val;
                else if (key === 'ARTIST' && val) artist = val;
                else if (key === 'ALBUM' && val) album = val;
                else if (key === 'GENRE' && val) genre = val;
                else if (key === 'DATE' && val) year = parseInt(val, 10) || year;
              }
            }
          }
        } catch {
          // Ignore comment block errors
        }
      }

      // Block 6: PICTURE
      else if (blockType === 6) {
        try {
          const picView = new DataView(headerSlice, offset, blockLength);
          let pOffset = 4; // Skip picture type
          const mimeLen = picView.getUint32(pOffset, false);
          pOffset += 4;
          const mime = new TextDecoder('ascii').decode(new Uint8Array(headerSlice, offset + pOffset, mimeLen));
          pOffset += mimeLen;

          const descLen = picView.getUint32(pOffset, false);
          pOffset += 4 + descLen;
          pOffset += 16; // Skip width, height, bitDepth, colors

          const dataLen = picView.getUint32(pOffset, false);
          pOffset += 4;

          if (pOffset + dataLen <= blockLength) {
            const picBytes = new Uint8Array(headerSlice, offset + pOffset, dataLen);
            const blob = new Blob([picBytes], { type: mime || 'image/jpeg' });
            artwork = URL.createObjectURL(blob);
          }
        } catch {
          // Ignore picture parsing failure
        }
      }

      offset += blockLength;
    }

    qualityTier = (sampleRate >= 88200 || (bitDepth && bitDepth >= 24)) ? 'HI_RES_LOSSLESS' : 'LOSSLESS';
  }

  // =========================================================================
  // 2. RIFF WAVE / PCM DECODER
  // =========================================================================
  else if (
    headerSlice.byteLength > 12 &&
    String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) === 'RIFF' &&
    String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)) === 'WAVE'
  ) {
    codec = 'PCM';
    container = 'WAV';
    isLossless = true;
    isGenuineLossless = true;

    let offset = 12;
    while (offset < headerSlice.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        channels = view.getUint16(offset + 10, true);
        sampleRate = view.getUint32(offset + 12, true);
        bitDepth = view.getUint16(offset + 22, true);
        bitrate = Math.round((sampleRate * channels * bitDepth) / 1000);
        break;
      }
      offset += 8 + chunkSize;
    }

    qualityTier = (sampleRate >= 88200 || (bitDepth && bitDepth >= 24)) ? 'HI_RES_LOSSLESS' : 'LOSSLESS';
  }

  // =========================================================================
  // 3. ID3v2 (MP3 / AAC / AIFF)
  // =========================================================================
  else if (
    headerSlice.byteLength > 10 &&
    String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) === 'ID3'
  ) {
    codec = fileName.endsWith('.aac') ? 'AAC' : fileName.endsWith('.aiff') ? 'AIFF' : 'MP3';
    container = fileName.endsWith('.aac') ? 'AAC' : fileName.endsWith('.aiff') ? 'AIFF' : 'MPEG';
    isLossless = codec === 'AIFF';
    isGenuineLossless = codec === 'AIFF';
    qualityTier = isLossless ? 'LOSSLESS' : 'HIGH';
    bitrate = isLossless ? 1411 : 320;

    let offset = 10;
    const tagSize =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);

    const maxOffset = Math.min(headerSlice.byteLength, 10 + tagSize);

    while (offset < maxOffset - 10) {
      const frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );

      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const frameSize = view.getUint32(offset + 4);
      if (frameSize <= 0 || offset + 10 + frameSize > headerSlice.byteLength) break;

      const contentOffset = offset + 10;
      const textDecoder = new TextDecoder('utf-8');

      if (frameId === 'TIT2') {
        const text = textDecoder.decode(new Uint8Array(headerSlice, contentOffset + 1, frameSize - 1));
        if (text.trim()) title = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TPE1') {
        const text = textDecoder.decode(new Uint8Array(headerSlice, contentOffset + 1, frameSize - 1));
        if (text.trim()) artist = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TALB') {
        const text = textDecoder.decode(new Uint8Array(headerSlice, contentOffset + 1, frameSize - 1));
        if (text.trim()) album = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TCON') {
        const text = textDecoder.decode(new Uint8Array(headerSlice, contentOffset + 1, frameSize - 1));
        if (text.trim()) genre = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TYER' || frameId === 'TDRC') {
        const text = textDecoder.decode(new Uint8Array(headerSlice, contentOffset + 1, frameSize - 1));
        const parsed = parseInt(text.trim(), 10);
        if (parsed > 1900 && parsed < 2100) year = parsed;
      } else if (frameId === 'APIC') {
        try {
          const picBytes = new Uint8Array(headerSlice, contentOffset, frameSize);
          let picStart = -1;
          let mime = 'image/jpeg';
          for (let i = 0; i < picBytes.length - 3; i++) {
            if (picBytes[i] === 0xff && picBytes[i + 1] === 0xd8) {
              picStart = i;
              mime = 'image/jpeg';
              break;
            } else if (
              picBytes[i] === 0x89 &&
              picBytes[i + 1] === 0x50 &&
              picBytes[i + 2] === 0x4e &&
              picBytes[i + 3] === 0x47
            ) {
              picStart = i;
              mime = 'image/png';
              break;
            }
          }

          if (picStart !== -1) {
            const imgBlob = new Blob([picBytes.slice(picStart)], { type: mime });
            artwork = URL.createObjectURL(imgBlob);
          }
        } catch {
          // Ignore picture parsing failure
        }
      }

      offset += 10 + frameSize;
    }
  }

  // =========================================================================
  // 4. M4A / ALAC / AAC / OPUS FALLBACKS BY EXTENSION
  // =========================================================================
  else {
    if (fileName.endsWith('.flac')) {
      codec = 'FLAC';
      container = 'FLAC';
      isLossless = true;
      isGenuineLossless = true;
      qualityTier = 'LOSSLESS';
    } else if (fileName.endsWith('.alac') || (fileName.endsWith('.m4a') && fileName.includes('lossless'))) {
      codec = 'ALAC';
      container = 'M4A';
      isLossless = true;
      isGenuineLossless = true;
      bitDepth = 16;
      qualityTier = 'LOSSLESS';
    } else if (fileName.endsWith('.wav')) {
      codec = 'PCM';
      container = 'WAV';
      isLossless = true;
      isGenuineLossless = true;
      bitDepth = 16;
      qualityTier = 'LOSSLESS';
    } else if (fileName.endsWith('.opus')) {
      codec = 'OPUS';
      container = 'OGG';
      isLossless = false;
      qualityTier = 'HIGH';
      bitrate = 160;
    } else if (fileName.endsWith('.m4a') || fileName.endsWith('.aac')) {
      codec = 'AAC';
      container = 'M4A';
      isLossless = false;
      qualityTier = 'HIGH';
      bitrate = 256;
    } else {
      codec = 'MP3';
      container = 'MPEG';
      isLossless = false;
      qualityTier = 'STANDARD';
      bitrate = 192;
    }
  }

  // Get duration using offscreen audio element if not already computed
  if (duration <= 0) {
    duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration || 180));
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        resolve(180);
        URL.revokeObjectURL(url);
      };
    });
  }

  const accentColor = await extractDominantColor(artwork);

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist,
    album,
    duration,
    genre,
    year,
    isLocal: true,
    fileBlob: file,
    artwork,
    accentColor,
    audioUrl: URL.createObjectURL(file),
    mood: 'Focus',

    // Authentic Lossless Specs
    codec,
    container,
    bitDepth,
    sampleRate,
    channels,
    bitrate,
    isLossless,
    isGenuineLossless,
    qualityTier,
  };
}
