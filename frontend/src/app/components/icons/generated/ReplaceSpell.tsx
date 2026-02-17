import type { SVGProps } from 'react';

export function ReplaceSpellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
  <path d="M 6.80 9.00 A 6 6 0 0 0 17.20 15.00" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 17.20 15.00 A 6 6 0 0 1 6.80 9.00" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 17.4 9.2 L 18.8 9.2 L 18.8 7.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 6.6 14.8 L 5.2 14.8 L 5.2 16.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 12 10.6 L 13.4 12 L 12 13.4 L 10.6 12 Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
}
