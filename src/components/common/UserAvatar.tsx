import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isGuest?: boolean;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name,
  email,
  size = 'md',
  isGuest = false,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  if (isGuest) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#8f867e] flex-shrink-0 ${className}`}
        title="Guest Session"
      >
        <User className={iconSizes} />
      </div>
    );
  }

  if (avatarUrl && !imageError) {
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden bg-[#1f1d1b] border border-white/10 flex-shrink-0 ${className}`}
      >
        <img
          src={avatarUrl}
          alt={name || email || 'User Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Derive initial from name or email
  const displayName = name || email || 'AURA';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-tr from-[#f3c5a6]/20 to-[#00f2fe]/20 border border-white/15 flex items-center justify-center font-bold text-white tracking-wider flex-shrink-0 shadow-inner ${className}`}
      title={displayName}
    >
      <span>{initial}</span>
    </div>
  );
};
