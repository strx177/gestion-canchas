import type { SVGProps } from 'react';

const paths = {
  dashboard: 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
  calendar: 'M8 2v4 M16 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2z M8 13h3 M8 17h3',
  booking: 'M4 5h16v15H4z M8 3v4 M16 3v4 M8 11h8 M8 15h5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 11l2 2 4-4',
  payments: 'M3 6h18v13H3z M3 10h18 M7 15h3',
  tools: 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-2-2z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v4a5 5 0 0 1-10 0V4z M7 6H4v2a4 4 0 0 0 4 4 M17 6h3v2a4 4 0 0 1-4 4',
  match: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5 M12 4v16',
  table: 'M3 4h18v16H3z M3 9h18 M9 9v11 M15 9v11',
  chart: 'M3 3v18h18 M8 16v-5 M13 16V6 M18 16v-8',
  report: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
  tag: 'M20 13l-7 7-10-10V3h7z M7.5 7.5h.01',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.03a1.7 1.7 0 0 0-1.82.36l-.06.06h-3.4l-.03-.08a1.7 1.7 0 0 0-1.3-1.22l-.08-.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 10 14.1l-.03-.08v-3.4L10 10.6a1.7 1.7 0 0 0-.36-1.82l-.06-.06 1.7-2.94.08.03a1.7 1.7 0 0 0 1.82-.36l.06-.06h3.4l.03.08a1.7 1.7 0 0 0 1.3 1.22l.08.02 1.7 2.94-.06.06A1.7 1.7 0 0 0 19.4 11l.03.08v3.4z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.35-4.35',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M18 6 6 18 M6 6l12 12',
  plus: 'M12 5v14 M5 12h14',
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  court: 'M3 5h18v14H3z M12 5v14 M3 12h18 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5.6 9a7 7 0 0 1 11.6-2L20 12 M4 12l2.8 5a7 7 0 0 0 11.6-2',
  filter: 'M4 5h16 M7 12h10 M10 19h4',
  check: 'm5 12 4 4L19 6'
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
