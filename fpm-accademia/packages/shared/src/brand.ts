/** Testi di brand fissi: non personalizzabili dal docente. */
export const BRAND = {
  appName: 'Accademia Musicale Online',
  shortName: 'FPM',
  copyright: '© 2026 FP Morelli — Web Design Tech',
} as const;

/** Prezzi e regole commerciali consolidate (specifica 22/11/2026). */
export const COMMERCIAL = {
  teacherLicensePriceEurCents: 9990,
  teacherLicenseLabel: '€99,90 una tantum, licenza permanente',
  trialHours: 24,
  trialDemoLessonMinutes: 20,
  studentPrice: 0,
} as const;
