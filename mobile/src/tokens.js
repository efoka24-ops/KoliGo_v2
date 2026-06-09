// Design tokens — couleurs, polices, utilitaires

export const C = {
  green:       '#0D7A3E',
  greenDark:   '#095C2E',
  greenLight:  '#E8F5EE',
  greenSoft:   '#F1F8F3',
  orange:      '#F5611A',
  orangeLight: '#FEF0E8',
  ink:         '#111111',
  ink70:       'rgba(17,17,17,0.7)',
  ink55:       'rgba(17,17,17,0.55)',
  ink35:       'rgba(17,17,17,0.35)',
  ink12:       'rgba(17,17,17,0.12)',
  ink06:       'rgba(17,17,17,0.06)',
  cream:       '#F5F2EC',
  paper:       '#FFFFFF',
};

// Noms de polices après chargement via @expo-google-fonts
export const F = {
  h1:    'PlusJakartaSans_800ExtraBold',
  h2:    'PlusJakartaSans_700Bold',
  h3:    'PlusJakartaSans_600SemiBold',
  ui:    'DMSans_400Regular',
  uiMed: 'DMSans_500Medium',
  uiSemi:'DMSans_600SemiBold',
  uiBold:'DMSans_700Bold',
  mono:  'JetBrainsMono_400Regular',
};

export function shadow(elevation = 4) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: elevation / 2 },
    shadowOpacity: 0.07,
    shadowRadius: elevation,
    elevation,
  };
}

export function kgComputePrice({ distance, weight, type }) {
  const base = 500 + distance * 150 + weight * 100;
  const mult = { temporaire: 1, permanent: 1.15, vvip: 1.4, express: 1.25 }[type] || 1;
  return Math.round(base * mult);
}
