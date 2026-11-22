/** Icone di interfaccia a tratto (24×24), colore via currentColor. Disegnate per FPM, nessun set di terzi. */
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  live: 'M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c2.2.7 3.5 2.8 3.5 5.6',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  setup: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.7 7.7 0 0 1-1.7 1l-.3 2h-4l-.3-2a7.7 7.7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-2l-1.6-1.2 2-3.4 1.9.7a7.7 7.7 0 0 1 1.7-1l.3-2h4l.3 2a7.7 7.7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 2z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5',
  login: 'M14 4h5v16h-5M10 8l4 4-4 4M14 12H3',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H8',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  mic: 'M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  micOff: 'M3 3l18 18M15.5 10V6.5a3.5 3.5 0 0 0-6.8-1.2M8.5 9v2.5a3.5 3.5 0 0 0 5.6 2.8M5.5 11.5a6.5 6.5 0 0 0 10.6 5M18.5 11.5c0 .9-.2 1.8-.5 2.6M12 18v3',
  cam: 'M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5',
  camOff: 'M3 3l18 18M15 11V7H9M3 7v10h12v-2M15 10.5l6-3.5v10l-3-1.7',
  screen: 'M3 4h18v12H3zM8 20h8M12 16v4M9 10l3-3 3 3M12 7v6',
  record: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  addUser: 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c0-3.6 2.9-6 6.5-6 1.4 0 2.6.3 3.6.9M18 14v6M15 17h6',
  hangup: 'M3 14.5c5-4.6 13-4.6 18 0l-2.4 2.4-3.3-1.4v-2.4a12 12 0 0 0-6.6 0v2.4l-3.3 1.4z',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  metronome: 'M9 3h6l4 18H5zM12 17l5-10M8 14h8',
  sheet: 'M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 14.5h8M8 18h5',
  book: 'M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0zM21 5c-3-1.5-6-1.5-9 0v15c3-1.5 6-1.5 9 0z',
  wave: 'M3 12h1M6 9v6M9 6v12M12 9v6M15 4v16M18 8v8M21 11v2',
  breath: 'M12 3v8M12 11c-2-1-3.5 0-4.5 2-1.2 2.6-2 5.5-4 7.5 3 .5 6-.5 7.5-3 .7-1.2 1-3 1-6.5zM12 11c2-1 3.5 0 4.5 2 1.2 2.6 2 5.5 4 7.5-3 .5-6-.5-7.5-3-.7-1.2-1-3-1-6.5z',
  tuner: 'M4 17a8 8 0 1 1 16 0M12 17l4-6M7 13l-1-1M12 9V8M17 13l1-1',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  loop: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  folder: 'M3 6h6l2 2h10v11H3z',
  chevron: 'M9 6l6 6-6 6',
  grid1: 'M4 5h16v14H4z',
  grid2: 'M3 5h8v14H3zM13 5h8v14h-8z',
  grid4: 'M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
} as const;

export type IconName = keyof typeof PATHS;

export function UiIcon({ name, className, size = 22 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
