import type { SVGProps } from 'react';

export function RangeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
  <path d="M 19 12 A 7 7 0 1 0 5 12 A 7 7 0 1 0 19 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 15.2 12 A 3.2 3.2 0 1 0 8.8 12 A 3.2 3.2 0 1 0 15.2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 12 10.8 L 13.2 12 L 12 13.2 L 10.8 12 Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
}
