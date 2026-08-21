/**
 * Design tokens ported from kpis-management (frontend-kpis-management/src/index.css)
 * OKLCH values converted to hex/rgba for React Native compatibility.
 */

export const brand = {
  emerald: '#10B981',
  emeraldLight: '#34d399',
  emeraldDark: '#059669',
  cyan: '#00F2FE',
  cyanLight: '#22d3ee',
  logoBg: '#101214',
  logoStroke: '#4B5563',
};

export const status = {
  success: '#34d399',
  error: '#f87171',
  errorDark: '#e5484d',
  warning: '#fbbf24',
  warningAlt: '#fb923c',
  info: '#818cf8',
};

export const light = {
  background: '#F4F5F0',
  foreground: '#1A231D',
  card: '#FDFDFD',
  cardRaised: '#FFFFFF',
  subtle: '#F7F7F5',
  primary: brand.emeraldLight,
  primaryForeground: '#04120B',
  secondary: '#EEF0F5',
  secondaryForeground: '#1A231D',
  muted: '#F7F7F7',
  mutedForeground: '#6B7280',
  accent: '#E7ECFB',
  destructive: status.errorDark,
  border: '#E7E7EA',
  input: '#FFFFFF',
  sidebar: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textMicro: '#B0B4BB',
  borderLine: '#E7E7EA',
  borderSubtle: '#EFEFF1',
  borderStrong: '#D1D5DB',
};

export const dark = {
  background: '#0E0E0E',
  foreground: '#F3F3F3',
  card: '#1B1B1B',
  cardRaised: '#212121',
  subtle: '#181818',
  primary: brand.emeraldLight,
  primaryForeground: '#04120B',
  secondary: '#25242C',
  secondaryForeground: '#F3F3F3',
  muted: '#1E1E1E',
  mutedForeground: '#9CA3AF',
  accent: '#232336',
  destructive: '#f2555a',
  border: '#2A2A2E',
  input: '#1B1B1B',
  sidebar: '#161619',
  textPrimary: '#F3F3F3',
  textSecondary: '#B7BAC2',
  textMuted: '#8A8D96',
  textMicro: '#6E7078',
  borderLine: '#2A2A2E',
  borderSubtle: '#232327',
  borderStrong: '#37373C',
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 22,
  xl: 28,
  full: 999,
};

export const spacing = (n: number) => n * 4.32; // base ~0.27rem

export const gradients = {
  primary: [brand.emerald, brand.cyanLight] as const,
  primaryHover: [brand.emeraldDark, brand.cyan] as const,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  }),
};

export type ThemeColors = typeof light;

export const fonts = {
  brand: 'SpaceGrotesk_700Bold',
  brandMedium: 'SpaceGrotesk_500Medium',
  sans: undefined, // system font, matches kpis-management (system-ui)
};
