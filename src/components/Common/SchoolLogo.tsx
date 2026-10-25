import React, { useState } from 'react';

interface SchoolLogoProps {
  logoUrl?: string | null;
  schoolName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-8 h-8 max-h-8 max-w-8',
  md: 'w-12 h-12 max-h-12 max-w-12',
  lg: 'w-16 h-16 max-h-16 max-w-16',
  xl: 'w-20 h-20 max-h-20 max-w-20',
};

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  logoUrl,
  schoolName = 'شعار المدرسة',
  size = 'md',
  className = '',
  fallbackIcon,
}) => {
  const [hasError, setHasError] = useState(false);

  // If no logo is provided or it failed to load
  if (!logoUrl || hasError) {
    if (fallbackIcon) {
      return <>{fallbackIcon}</>;
    }
    // Return null without taking up any layout space or broken image icon
    return null;
  }

  const sizeClass = size === 'custom' ? '' : SIZE_CLASSES[size];

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${sizeClass} ${className}`}
    >
      <img
        src={logoUrl}
        alt={schoolName}
        onError={() => setHasError(true)}
        className="w-full h-full object-contain pointer-events-none select-none"
        style={{
          imageRendering: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
};
