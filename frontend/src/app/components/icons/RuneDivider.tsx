import type { SvgIcon } from './runeIcons';
import {
  CornerFlourishLeftIcon,
  CornerFlourishRightIcon,
  DividerOrnateIcon,
  DividerSectionIcon,
  DividerShortIcon,
  DividerSimpleIcon,
} from './runeIcons';
import { RuneIcon } from './RuneIcon';

const DIVIDER_MAP: Record<'simple' | 'ornate' | 'short' | 'section' | 'corner-left' | 'corner-right', SvgIcon> = {
  simple: DividerSimpleIcon,
  ornate: DividerOrnateIcon,
  short: DividerShortIcon,
  section: DividerSectionIcon,
  'corner-left': CornerFlourishLeftIcon,
  'corner-right': CornerFlourishRightIcon,
};

interface RuneDividerProps {
  kind?: 'simple' | 'ornate' | 'short' | 'section' | 'corner-left' | 'corner-right';
  className?: string;
  size?: 16 | 18 | 20 | 24;
}

export function RuneDivider({ kind = 'simple', className, size = 24 }: RuneDividerProps) {
  const Icon = DIVIDER_MAP[kind];
  return <RuneIcon icon={Icon} label="" size={size} variant="gold" interactive={false} className={className} />;
}
