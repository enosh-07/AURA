import { Track } from '../types/audio';

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
          // Avoid near-black or near-white
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

        // Boost saturation slightly
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
 * Simple client-side ID3v2 tag parser to extract Title, Artist, Album, and embedded APIC artwork.
 */
export async function parseAudioFile(file: File): Promise<Track> {
  const buffer = await file.slice(0, 128 * 1024).arrayBuffer(); // Read first 128KB for ID3v2
  const view = new DataView(buffer);

  let title = file.name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s\-_.]*/, '');
  let artist = 'Local Artist';
  let album = 'Local Audio Studio';
  let genre = 'Imported';
  let artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80';

  // Check for ID3v2 header: 'ID3'
  if (
    buffer.byteLength > 10 &&
    String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) === 'ID3'
  ) {
    let offset = 10;
    const tagSize =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);

    const maxOffset = Math.min(buffer.byteLength, 10 + tagSize);

    while (offset < maxOffset - 10) {
      const frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );

      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const frameSize = view.getUint32(offset + 4);
      if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) break;

      const contentOffset = offset + 10;
      const textDecoder = new TextDecoder('utf-8');

      // Title (TIT2), Artist (TPE1), Album (TALB), Genre (TCON)
      if (frameId === 'TIT2') {
        const text = textDecoder.decode(new Uint8Array(buffer, contentOffset + 1, frameSize - 1));
        if (text.trim()) title = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TPE1') {
        const text = textDecoder.decode(new Uint8Array(buffer, contentOffset + 1, frameSize - 1));
        if (text.trim()) artist = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TALB') {
        const text = textDecoder.decode(new Uint8Array(buffer, contentOffset + 1, frameSize - 1));
        if (text.trim()) album = text.replace(/\0/g, '').trim();
      } else if (frameId === 'TCON') {
        const text = textDecoder.decode(new Uint8Array(buffer, contentOffset + 1, frameSize - 1));
        if (text.trim()) genre = text.replace(/\0/g, '').trim();
      } else if (frameId === 'APIC') {
        // Embedded picture
        try {
          const picBytes = new Uint8Array(buffer, contentOffset, frameSize);
          // Find start of JPEG (0xFF, 0xD8) or PNG (0x89, 0x50, 0x4E, 0x47)
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
          // Ignore picture parsing failure and use fallback
        }
      }

      offset += 10 + frameSize;
    }
  }

  // Get duration using an offscreen audio element
  const duration = await new Promise<number>((resolve) => {
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

  const accentColor = await extractDominantColor(artwork);

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist,
    album,
    duration,
    genre,
    year: new Date().getFullYear(),
    isLocal: true,
    fileBlob: file,
    artwork,
    accentColor,
    audioUrl: URL.createObjectURL(file),
    mood: 'Focus',
  };
}
