/**
 * AURA Artwork Resilience & Neutral Branded Fallback Engine
 * =========================================================
 * Provides authoritative artwork validation, protocol upgrading (http -> https),
 * image URL resolution upscaling (e.g. JioSaavn 150x150 -> 500x500, iTunes 100x100 -> 600x600),
 * and dynamic procedural vector fallbacks that never reuse another song's cover.
 */

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Generates an ultra-premium, dark cinematic SVG data URL with stylized vinyl groove,
 * center label, and track typography with dynamic accent glow.
 */
export function generateAuraPlaceholder(
  title?: string,
  artist?: string,
  accentColor = '#00f2fe'
): string {
  const cleanTitle = (title || 'AURA').trim();
  const cleanArtist = (artist || 'Master Audio').trim();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141319"/>
      <stop offset="50%" stop-color="#0a090d"/>
      <stop offset="100%" stop-color="#191418"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ff3d00" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="28" fill="url(#bg)"/>
  <circle cx="200" cy="180" r="130" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="2"/>
  <circle cx="200" cy="180" r="105" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="2"/>
  <circle cx="200" cy="180" r="80" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
  <circle cx="200" cy="180" r="55" fill="url(#glow)"/>
  <circle cx="200" cy="180" r="20" fill="#0a090d" stroke="${accentColor}" stroke-opacity="0.6" stroke-width="2"/>
  <circle cx="200" cy="180" r="7" fill="${accentColor}"/>
  <text x="200" y="325" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#ffffff" fill-opacity="0.9" text-anchor="middle">${escapeXml(
    cleanTitle.slice(0, 20)
  )}</text>
  <text x="200" y="352" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="14" fill="#a09890" text-anchor="middle">${escapeXml(
    cleanArtist.slice(0, 26)
  )}</text>
  <text x="200" y="48" font-family="monospace" font-weight="700" font-size="11" fill="${accentColor}" fill-opacity="0.8" text-anchor="middle" letter-spacing="3">AURA SOUND</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Normalizes and upgrades artwork URLs to maximum available resolution
 */
export function getOptimizedArtworkUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();
  if (!url) return null;

  // Upgrade JioSaavn thumbnails to 500x500 high-resolution
  if (url.includes('saavncdn.com')) {
    url = url
      .replace(/_150x150\.(jpg|png|jpeg)/i, '_500x500.$1')
      .replace(/150x150\.(jpg|png|jpeg)/i, '500x500.$1')
      .replace(/_50x50\.(jpg|png|jpeg)/i, '_500x500.$1')
      .replace(/50x50\.(jpg|png|jpeg)/i, '500x500.$1');
  }

  // Upgrade iTunes thumbnails from 100x100 to 600x600
  if (url.includes('mzstatic.com')) {
    url = url
      .replace(/100x100bb\.(jpg|png)/i, '600x600bb.$1')
      .replace(/200x200bb\.(jpg|png)/i, '600x600bb.$1');
  }

  // Enforce secure HTTPS
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }

  return url;
}
