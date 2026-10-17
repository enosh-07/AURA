import type { Metadata, Viewport } from 'next';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'AURA — Next-Generation Lossless AI Music Platform',
  description: 'Ultra-modern, high-fidelity lossless AI music streaming player with 10-band acoustic equalizer, 60fps real-time visualizers, and intelligent AI music companion.',
  keywords: ['Music Player', 'Lossless Audio', 'FLAC', 'Hi-Res Audio', 'Acoustic Lab', 'AI DJ', 'Web Audio API'],
  authors: [{ name: 'AURA Team' }],
  openGraph: {
    title: 'AURA — Next-Generation Lossless AI Music Platform',
    description: 'Experience pure 24-bit/96kHz lossless acoustic streaming and real-time AI music intelligence.',
    url: 'https://aura.audio',
    siteName: 'AURA Audio',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&h=630&fit=crop',
        width: 1200,
        height: 630,
        alt: 'AURA Music Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-[#0a0908] text-[#f4eee8]">
      <body className="bg-[#0a0908] text-[#f4eee8] antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
