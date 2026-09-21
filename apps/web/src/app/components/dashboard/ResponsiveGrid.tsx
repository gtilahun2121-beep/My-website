'use client';

import React from 'react';

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: string;
  className?: string;
}

/**
 * Responsive grid component for dashboard layouts
 * Default: 1 col on mobile, 2 cols on tablet, 3+ cols on desktop
 */
export default function ResponsiveGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'gap-4',
  className = '',
}: ResponsiveGridProps) {
  const gridClass = `
    grid 
    grid-cols-${cols.mobile || 1} 
    sm:grid-cols-${cols.tablet || 2} 
    lg:grid-cols-${cols.desktop || 3}
    ${gap}
    ${className}
  `
    .replace(/\s+/g, ' ')
    .trim();

  return <div className={gridClass}>{children}</div>;
}
