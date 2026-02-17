import React from 'react';
import { cn } from './ui/utils';

const SCHOOL_COLORS: Record<string, string> = {
  abjuration: '#C6A35B',
  conjuration: '#3E8F87',
  divination: '#3D6FA6',
  enchantment: '#9C4B8C',
  evocation: '#B44A2F',
  illusion: '#6D4BA6',
  necromancy: '#3B7A4A',
  transmutation: '#8A6A3D',
};

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SchoolTagProps {
  school: string;
  variant?: 'dot' | 'pill';
  surface?: 'dark' | 'paper';
  className?: string;
}

export function SchoolTag({
  school,
  variant = 'pill',
  surface = 'dark',
  className,
}: SchoolTagProps) {
  const color = SCHOOL_COLORS[school.toLowerCase()] || '#8A6A3D';

  if (variant === 'dot') {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block h-2 w-2 rounded-full', className)}
        style={{ backgroundColor: color }}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[12px] font-ui font-semibold',
        className,
      )}
      style={{
        backgroundColor: hexToRgba(color, 0.12),
        borderColor: hexToRgba(color, 0.45),
        color: surface === 'paper' ? 'var(--ink)' : 'var(--text)',
      }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {school}
    </span>
  );
}
