/**
 * Theme hook — returns the current palette based on system color scheme.
 *
 * Usage:
 *   const t = useTheme();
 *   <View style={{ backgroundColor: t.surface }} />
 */
import { useColorScheme } from 'react-native';
import { color, type ColorMode } from './tokens';

export function useTheme() {
  const scheme: ColorMode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return color[scheme];
}

export function useThemeMode(): ColorMode {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}
