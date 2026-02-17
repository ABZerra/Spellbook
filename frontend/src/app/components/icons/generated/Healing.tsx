import type { SVGProps } from 'react';

export function HealingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
  <path d="M 12 7 V 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 7 12 H 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 18.5 12 A 6.5 6.5 0 1 0 5.5 12 A 6.5 6.5 0 1 0 18.5 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 12 4.0 L 13.0 5 L 12 6.0 L 11.0 5 Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
}
