import type { SVGProps } from 'react';

export function DamageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
  <path d="M 8 17 L 16 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 10 7 H 16 V 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 12 11.0 L 13.0 12 L 12 13.0 L 11.0 12 Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
}
