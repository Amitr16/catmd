/**
 * SourceChip — single citation link used on the ResultCard footer.
 * LLM-only sources render as "AI reference" with a muted warning color,
 * per the "mark LLM-only cards clearly" requirement.
 */
import { Linking, Pressable, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import { Text } from './Text';
import { Sparkle, Link as LinkIcon } from 'phosphor-react-native';

export type SourceChipProps = {
  url: string;
  title: string;
  style?: ViewStyle;
};

function hostOf(url: string): string {
  try {
    if (url.startsWith('internal://')) return 'AI reference';
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

export function SourceChip({ url, title, style }: SourceChipProps) {
  const t = useTheme();
  const isInternal = url.startsWith('internal://');
  const label = hostOf(url);
  const Icon = isInternal ? Sparkle : LinkIcon;
  const color = isInternal ? t.warning : t.primary700;

  const onPress = () => {
    if (!isInternal) Linking.openURL(url).catch(() => {});
  };

  return (
    <Pressable
      accessibilityRole={isInternal ? 'text' : 'link'}
      accessibilityLabel={isInternal ? `AI reference: ${title}` : `Source: ${title} at ${label}`}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          paddingHorizontal: space[2],
          paddingVertical: 4,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: t.borderSubtle,
          backgroundColor: t.surfaceSunken,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Icon size={12} color={color} weight={isInternal ? 'fill' : 'regular'} />
      <Text token="caption" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
