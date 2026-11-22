import type { DisciplineId } from '@fpm/shared';

/** Icone originali a tratto (oro tramite currentColor), nessun asset di terzi. */
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 48 48',
  'aria-hidden': true,
};

export function DisciplineIcon({ id, className }: { id: DisciplineId; className?: string }) {
  switch (id) {
    case 'canto':
      return (
        <svg {...common} className={className}>
          <rect x="17" y="5" width="14" height="22" rx="7" />
          <path d="M11 22a13 13 0 0 0 26 0M24 35v8M17 43h14" />
        </svg>
      );
    case 'pianoforte':
      return (
        <svg {...common} className={className}>
          <rect x="5" y="12" width="38" height="26" rx="2" />
          <path d="M13 12v26M21 12v26M29 12v26M37 12v26" />
          <path d="M11 12v14h4V12M19 12v14h4V12M33 12v14h4V12" fill="currentColor" />
        </svg>
      );
    case 'chitarra-basso':
      return (
        <svg {...common} className={className}>
          <path d="M30 18l11-11M38 4l6 6" />
          <path d="M28 20c-3-3-9-2-11 2-1 2-4 2-6 3-5 2-6 9-2 13s11 3 13-2c1-2 1-5 3-6 4-2 5-8 3-10z" />
          <circle cx="20" cy="29" r="3" />
        </svg>
      );
    case 'batteria':
      return (
        <svg {...common} className={className}>
          <ellipse cx="24" cy="24" rx="15" ry="5" />
          <path d="M9 24v11c0 3 7 5 15 5s15-2 15-5V24M14 28v10M34 28v10" />
          <path d="M8 6l12 14M40 6L28 20" />
        </svg>
      );
    case 'archi':
      return (
        <svg {...common} className={className}>
          <path d="M24 4v8M20 12h8M21 12c-6 2-8 7-5 11-4 3-5 10 0 14 4 3 12 3 16 0 5-4 4-11 0-14 3-4 1-9-5-11" />
          <path d="M22 22v12M26 22v12M6 42L42 10" />
        </svg>
      );
    case 'fiati':
      return (
        <svg {...common} className={className}>
          <path d="M4 34L40 10l3 4L7 38z" />
          <circle cx="16" cy="28" r="1.5" />
          <circle cx="22" cy="24" r="1.5" />
          <circle cx="28" cy="20" r="1.5" />
          <circle cx="34" cy="16" r="1.5" />
        </svg>
      );
    case 'teoria':
      return (
        <svg {...common} className={className}>
          <path d="M4 14h40M4 20h40M4 26h40M4 32h40M4 38h40" strokeWidth={1} />
          <ellipse cx="16" cy="32" rx="4" ry="3" fill="currentColor" />
          <path d="M20 32V12l12 4" />
          <ellipse cx="32" cy="26" rx="4" ry="3" fill="currentColor" />
          <path d="M36 26V10" />
        </svg>
      );
  }
}

export function TeacherIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="18" cy="14" r="7" />
      <path d="M5 40c0-8 6-13 13-13s13 5 13 13" />
      <path d="M30 8h14v14H33M37 22v-8" />
    </svg>
  );
}

export function StudentIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="24" cy="15" r="8" />
      <path d="M8 42c0-9 7-15 16-15s16 6 16 15" />
      <path d="M14 30l10 6 10-6" />
    </svg>
  );
}
