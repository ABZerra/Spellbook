import type { ComponentType, SVGProps } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';

export type RuneIconProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  size?: 16 | 18 | 20 | 24;
  variant?: 'default' | 'gold' | 'danger' | 'muted';
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
};

export function RuneIcon({
  icon: Icon,
  label,
  size = 18,
  variant = 'default',
  interactive = true,
  selected = false,
  disabled = false,
  className,
}: RuneIconProps) {
  const variantClass = {
    default: 'text-text-muted',
    muted: 'text-text-dim',
    gold: 'text-gold',
    danger: 'text-blood',
  }[variant];

  const interactiveClass = interactive && !disabled
    ? variant === 'danger'
      ? 'cursor-pointer hover:text-blood hover:bg-blood-soft focus-visible:ring-2 focus-visible:ring-blood-soft'
      : 'cursor-pointer hover:text-gold hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-gold-soft'
    : '';

  const selectedClass = selected
    ? variant === 'danger'
      ? 'text-blood-2 bg-blood-soft'
      : 'text-gold-2 bg-gold-soft'
    : '';

  // Increase the smallest icon tier globally to improve legibility in dense rows.
  const renderedSize = size === 16 ? 18 : size;

  const iconEl = (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors',
        variantClass,
        interactiveClass,
        selectedClass,
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
      style={{ width: `${renderedSize}px`, height: `${renderedSize}px` }}
      aria-hidden
    >
      <Icon width={renderedSize} height={renderedSize} aria-label={label} />
    </span>
  );

  if (!label) return iconEl;

  if (!interactive || disabled) {
    return iconEl;
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={label}>
          {iconEl}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
