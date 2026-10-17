import React, { useState } from 'react';
import { getOptimizedArtworkUrl, generateAuraPlaceholder } from '../../utils/artworkHelper';

interface TrackArtworkProps {
  artworkUrl?: string | null;
  title?: string;
  artist?: string;
  accentColor?: string;
  className?: string;
  alt?: string;
}

export const TrackArtwork: React.FC<TrackArtworkProps> = ({
  artworkUrl,
  title = 'Track',
  artist = 'Artist',
  accentColor = '#00f2fe',
  className = 'w-full h-full object-cover',
  alt,
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const optimizedUrl = getOptimizedArtworkUrl(artworkUrl);
  const fallbackSvg = generateAuraPlaceholder(title, artist, accentColor);

  const displaySrc = !loadFailed && optimizedUrl ? optimizedUrl : fallbackSvg;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#16161a] select-none">
      {/* Loading Skeleton */}
      {!isLoaded && !loadFailed && (
        <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />
      )}

      <img
        key={`${title}-${optimizedUrl || 'fallback'}`}
        src={displaySrc}
        alt={alt || `${title} cover`}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setLoadFailed(true);
          setIsLoaded(true);
        }}
        loading="lazy"
      />
    </div>
  );
};
