/**
 * Renders text that may contain [ref:Card Topic] markers inline as
 * source-chip buttons. Tapping a chip shows an alert with the card topic
 * (the knowledge base lives on Supabase — we don't round-trip to fetch
 * the full card here).
 */
import { Alert, Pressable, View, type StyleProp, type TextStyle } from 'react-native';
import { Text, type CatTextProps } from './Text';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const CITATION_RE = /\[ref:([^\]]+)\]/g;

export type InlineCitationTextProps = CatTextProps & {
  children: string;
};

/**
 * Split a string on [ref:...] markers, preserving both segments so we
 * can render the text inline with pressable chips in between.
 */
export function InlineCitationText({
  children,
  ...textProps
}: InlineCitationTextProps) {
  const t = useTheme();
  const parts: Array<{ kind: 'text'; value: string } | { kind: 'ref'; value: string }> = [];
  let lastIndex = 0;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const source = children || '';
  const regex = new RegExp(CITATION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ kind: 'text', value: source.slice(lastIndex, m.index) });
    }
    parts.push({ kind: 'ref', value: m[1]!.trim() });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < source.length) {
    parts.push({ kind: 'text', value: source.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ kind: 'text', value: source });
  }

  const onChipPress = (topic: string) => {
    Alert.alert(
      topic,
      'This finding is drawn from CatMD\u2019s feline veterinary knowledge corpus. ' +
        'Sources include Merck Veterinary Manual, Cornell Feline Health Center, ' +
        'ICatCare, ASPCA, and peer-reviewed literature.',
      [{ text: 'OK' }],
    );
  };

  // React Native doesn't inline arbitrary components inside <Text> cleanly
  // without nested Text — so we render everything as Text children with
  // one Pressable chip per citation. Chips wrap via a <Text> inline.
  const chipStyle: StyleProp<TextStyle> = {
    color: t.primary700,
    backgroundColor: t.primary50,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
    fontFamily: 'Figtree_600SemiBold',
    fontSize: (textProps.token && textProps.token === 'caption') ? 11 : 13,
  };

  return (
    <Text {...textProps}>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <Text key={i} {...textProps}>{p.value}</Text>
        ) : (
          // Pressable-wrapped Text renders as a tappable inline chip
          <Text
            key={i}
            onPress={() => onChipPress(p.value)}
            style={chipStyle}
            accessibilityRole="link"
            accessibilityLabel={`Source: ${p.value}`}
            suppressHighlighting
          >
            {' '}
            {shortenTopic(p.value)}
            {' '}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Trim parenthetical expansions for inline display: "FLUTD (…)" → "FLUTD". */
function shortenTopic(topic: string): string {
  const paren = topic.indexOf('(');
  if (paren > 0) return topic.slice(0, paren).trim();
  return topic.length > 40 ? topic.slice(0, 38) + '…' : topic;
}

// Suppress unused-import warnings (View + Pressable re-exported from RN
// but consumed elsewhere).
void View;
void Pressable;
