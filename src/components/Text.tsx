/**
 * Text primitive — applies a type token from design-system.md.
 *
 *   <Text token="heading1" style={...}>…</Text>
 *
 * Variable-font weights aren't exposed in RN cleanly, so we embed the
 * weight in the font family name via @expo-google-fonts (which ships
 * the discrete weights we declared). Update the FAMILY_MAP when adding
 * weights.
 */
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { type ColorToken } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { font, type } from '../theme/tokens';

type TypeToken = keyof typeof type;

const FAMILY_MAP: Record<string, Record<string, string>> = {
  display: {
    '400': 'SourceSerif4_400Regular',
    '500': 'SourceSerif4_500Medium',
    '600': 'SourceSerif4_600SemiBold',
    '700': 'SourceSerif4_700Bold',
  },
  ui: {
    '300': 'Figtree_300Light',
    '400': 'Figtree_400Regular',
    '500': 'Figtree_500Medium',
    '600': 'Figtree_600SemiBold',
    '700': 'Figtree_700Bold',
  },
  mono: {
    '400': 'JetBrainsMono_400Regular',
    '500': 'JetBrainsMono_500Medium',
    '700': 'JetBrainsMono_700Bold',
  },
};

export type CatTextProps = TextProps & {
  token?: TypeToken;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  token = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: CatTextProps) {
  const theme = useTheme();
  const t = type[token];
  const family = FAMILY_MAP[t.family]?.[t.weight] ?? 'Figtree_400Regular';
  const computed: StyleProp<TextStyle> = {
    fontFamily: family,
    fontSize: t.size,
    lineHeight: t.lh,
    letterSpacing: t.tracking * t.size, // em -> px
    color: color ? theme[color] : theme.textPrimary,
    textAlign: align,
  };
  // Clamp Dynamic Type on large tokens so a 200% system scale doesn't
  // blow out the hero layout; body-sized text stays fully scalable for
  // WCAG 1.4.4 compliance.
  const maxScale = t.size >= 40 ? 1.4 : t.size >= 28 ? 1.6 : undefined;

  return (
    <RNText
      maxFontSizeMultiplier={maxScale}
      style={[computed, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export { font };
