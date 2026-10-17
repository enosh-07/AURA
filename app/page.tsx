'use client';

import dynamic from 'next/dynamic';

const AuraShell = dynamic(
  () => import('../src/components/layout/Shell').then((mod) => mod.Shell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0908] text-[#00f2fe]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00f2fe] border-t-transparent" />
          <div className="font-mono text-xs uppercase tracking-widest text-white/60">
            Initializing AURA Acoustic Engine...
          </div>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <AuraShell />;
}
