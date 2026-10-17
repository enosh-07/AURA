import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q')?.toLowerCase();
  const genre = searchParams.get('genre')?.toLowerCase();
  const mood = searchParams.get('mood')?.toLowerCase();

  let filtered: any[] = [];

  if (q) {
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album?.toLowerCase().includes(q)
    );
  }

  if (genre && genre !== 'all') {
    filtered = filtered.filter((t) => t.genre.toLowerCase() === genre);
  }

  if (mood && mood !== 'all') {
    filtered = filtered.filter((t) => t.mood?.toLowerCase() === mood);
  }

  return NextResponse.json({
    success: true,
    data: filtered.map((t) => ({
      ...t,
      artworkUrl: t.artwork,
      audioUrl: t.audioUrl,
    })),
    meta: {
      page: 1,
      limit: filtered.length,
      total: filtered.length,
      totalPages: 1,
    },
  });
}
