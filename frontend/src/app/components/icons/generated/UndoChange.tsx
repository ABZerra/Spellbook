import type { SVGProps } from 'react';

export function UndoChangeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
  <path d="M 9 8 H 14.5 C 17.2 8 19 9.8 19 12.5 C 19 15.2 17.2 17 14.5 17 H 10.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 9 8 L 6.8 10.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 9 8 L 6.8 5.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M 10.2 16.1 L 11.1 17 L 10.2 17.9 L 9.299999999999999 17 Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
}
