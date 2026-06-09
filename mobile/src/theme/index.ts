import { DefaultTheme } from '@react-navigation/native';

export const colors = {
  green: '#178A3C',
  greenDark: '#0F6B2E',
  greenDeep: '#0B5224',
  green50: '#E7F2EA',
  green100: '#D2E8D8',
  forest: '#0E2A1C',
  forest2: '#143726',
  orange: '#E8551C',
  orangeDark: '#C8410F',
  orange50: '#FCEBE2',
  ink: '#15140F',
  ink2: '#3E3D36',
  muted: '#76746B',
  muted2: '#9A988E',
  app: '#F4F5F1',
  surface: '#FFFFFF',
  surface2: '#FBFBF8',
  line: '#E7E7E0',
  line2: '#EFEFEA',
  ok: '#178A3C',
  okBg: '#E7F2EA',
  warn: '#B8860B',
  warnBg: '#FBF1D8',
  danger: '#C2410C',
  dangerBg: '#FBE6DC',
  info: '#1F6FB2',
  infoBg: '#E4F0F8',
  white: '#FFFFFF',
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
export const spacing = (n: number) => n * 4;

export const type = {
  h1: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.2, color: colors.ink },
  h3: { fontSize: 15, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 14, fontWeight: '500' as const, color: colors.ink2 },
  lead: { fontSize: 13.5, fontWeight: '500' as const, color: colors.muted, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.muted },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, color: colors.muted },
  mono: { fontVariant: ['tabular-nums'] as const, fontWeight: '600' as const },
};

export const shadow = {
  sm: { shadowColor: '#15130F', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#15130F', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
};

export const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.app, card: colors.surface, text: colors.ink, border: colors.line, primary: colors.green },
};

export default { colors, radius, spacing, type, shadow, navTheme };
