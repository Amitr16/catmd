/**
 * CatMD Design System — Warm Clinical
 * Single source of truth for design tokens. See docs/design-system.md.
 *
 * - Cream + sage + terracotta + charcoal base
 * - Source Serif 4 (display) + Figtree (UI) + JetBrains Mono (stats)
 * - 4pt spacing substrate, 8pt rhythm
 * - 4/8/12/16 radii scale
 * - CVD-safe 4-tier urgency
 */

export const color = {
  light: {
    // Surfaces
    surface:          '#FAF7F2',
    surfaceElevated: '#FFFFFF',
    surfaceSunken:   '#F2EEE6',
    borderSubtle:    '#E6E0D3',
    borderStrong:    '#D0C8B8',

    // Text (all AA+ on cream)
    textPrimary:   '#1F2024',
    textSecondary: '#534B3E',
    textMuted:     '#7A7160',
    textInverse:   '#FAF7F2',

    // Brand — Sage (primary)
    primary50:  '#EDF3F0',
    primary100: '#D6E4DD',
    primary300: '#8FB4A5',
    primary500: '#5B8A7A',
    primary700: '#3F6456',
    primary900: '#25403A',

    // Brand — Terracotta (secondary / Bond + emotional / CTA accent)
    //
    // Used on surfaces that are about the *relationship* (Bond tab,
    // birthday banner, Read [cat] body language, personality cards) —
    // sage stays the medical/trust anchor (Triage, Track, Watch).
    // Together: sage = "I'm here to help your cat", terracotta =
    // "I'm here to help you understand your cat."
    secondary50:  '#FBEEE9',
    secondary100: '#F4D5C7',
    secondary300: '#E3A995',
    secondary500: '#C97B63',
    secondary700: '#9E5540',
    secondary900: '#5E2E1E',

    // Semantic + urgency (CVD-safe)
    urgencyRoutine: '#5B8A7A',
    urgencyMonitor: '#D4A24C',
    urgencyConcern: '#C97B63',
    urgencyUrgent:  '#8B2F1F',

    success: '#3F6456',
    warning: '#B07F28',
    error:   '#8B2F1F',
    info:    '#4A6B85',
  },
  dark: {
    surface:         '#15110D',
    surfaceElevated: '#1C1813',
    surfaceSunken:   '#120E0A',
    borderSubtle:    '#26211A',
    borderStrong:    '#322C23',

    textPrimary:   '#F2EEE6',
    textSecondary: '#B5AE9E',
    textMuted:     '#8A8374',
    textInverse:   '#15110D',

    primary50:  '#25403A',
    primary100: '#3F6456',
    primary300: '#B8D0C5',
    primary500: '#8FB4A5',
    primary700: '#D6E4DD',
    primary900: '#EDF3F0',

    secondary50:  '#5E2E1E',
    secondary100: '#7A3D2A',
    secondary300: '#9E5540',
    secondary500: '#E3A995',
    secondary700: '#FBEEE9',
    secondary900: '#FBEEE9',

    urgencyRoutine: '#8FB4A5',
    urgencyMonitor: '#E8C876',
    urgencyConcern: '#E09A7E',
    urgencyUrgent:  '#E06B55',

    success: '#8FB4A5',
    warning: '#E8C876',
    error:   '#E06B55',
    info:    '#8AAEC7',
  },
} as const;

export type ColorMode = keyof typeof color;
export type ColorToken = keyof typeof color.light;

export const font = {
  family: {
    display: 'SourceSerif4',
    ui:      'Figtree',
    mono:    'JetBrainsMono',
  },
} as const;

/** Type-scale tokens. Major Third 1.25, 16px base. Values in px. */
export const type = {
  displayXl: { size: 40, lh: 44, tracking: -0.02,   family: 'display' as const, weight: '500' as const },
  displayLg: { size: 32, lh: 36, tracking: -0.015,  family: 'display' as const, weight: '500' as const },
  heading1:  { size: 28, lh: 32, tracking: -0.01,   family: 'display' as const, weight: '500' as const },
  heading2:  { size: 22, lh: 28, tracking: -0.005,  family: 'display' as const, weight: '500' as const },
  heading3:  { size: 18, lh: 24, tracking: 0,       family: 'ui'      as const, weight: '600' as const },
  bodyLg:    { size: 17, lh: 26, tracking: 0,       family: 'ui'      as const, weight: '400' as const },
  body:      { size: 15, lh: 22, tracking: 0,       family: 'ui'      as const, weight: '400' as const },
  caption:   { size: 13, lh: 18, tracking: 0.005,   family: 'ui'      as const, weight: '500' as const },
  mono:      { size: 14, lh: 20, tracking: 0,       family: 'mono'    as const, weight: '500' as const },
  score:     { size: 72, lh: 76, tracking: -0.02,   family: 'display' as const, weight: '500' as const },
} as const;

export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
  8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96,
} as const;

export const radius = {
  none: 0,
  xs: 4,     // inputs, inline chips
  sm: 8,     // buttons, badges
  md: 12,    // cards (default)
  lg: 16,    // elevated cards, modals
  xl: 24,    // hero cards, score ring bg
  '2xl': 32, // bottom sheets
  full: 9999,
} as const;

export const elevation = {
  0: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  1: { shadowColor: '#1F2024', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.04, shadowRadius: 2,  elevation: 1 },
  2: { shadowColor: '#1F2024', shadowOffset: { width: 0, height: 2 },  shadowOpacity: 0.06, shadowRadius: 6,  elevation: 2 },
  3: { shadowColor: '#1F2024', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  4: { shadowColor: '#1F2024', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 48, elevation: 8 },
} as const;

export const motion = {
  duration: { instant: 50, fast: 150, base: 240, slow: 400, hero: 800 },
  easing: {
    standard:   [0.2, 0, 0, 1] as [number, number, number, number],
    emphasized: [0.3, 0, 0, 1] as [number, number, number, number],
  },
  spring: {
    soft:   { duration: 400, damping: 20, mass: 1 },
    bouncy: { duration: 500, damping: 12, mass: 1 },
  },
} as const;

/**
 * Urgency tier helpers — the 4 tiers from the design system.
 * Consumed by UrgencyBadge + ScoreRing to pick the right palette.
 */
export type UrgencyTier = 'routine' | 'monitor' | 'concern' | 'urgent';

export const urgencyTier = {
  routine: {
    token: 'urgencyRoutine' as const,
    label: 'Routine',
    icon:  'check' as const,
    scoreRange: [81, 100] as const,
    copy:  'Keep an eye on things — no concern right now.',
  },
  monitor: {
    token: 'urgencyMonitor' as const,
    label: 'Monitor',
    icon:  'eye' as const,
    scoreRange: [61, 80] as const,
    copy:  'Worth watching — re-scan in a day or so.',
  },
  concern: {
    token: 'urgencyConcern' as const,
    label: 'See Vet Soon',
    icon:  'flag' as const,
    scoreRange: [41, 60] as const,
    copy:  'Book a vet visit in the next 24–48 hours.',
  },
  urgent: {
    token: 'urgencyUrgent' as const,
    label: 'Urgent',
    icon:  'alert' as const,
    scoreRange: [0, 40] as const,
    copy:  'Contact your emergency vet now.',
  },
} as const;

export function tierFromScore(score: number): UrgencyTier {
  if (score >= 81) return 'routine';
  if (score >= 61) return 'monitor';
  if (score >= 41) return 'concern';
  return 'urgent';
}
