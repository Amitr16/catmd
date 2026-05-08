/**
 * ObservationBody — renders a behaviour-reader observation as a stack
 * of labelled sections with bold prefixes.
 *
 * The model emits the observation as plain text with literal blank
 * lines between sections — e.g.
 *
 *   Eyes: pupils mid-dilation, soft, one slow-blink mid-clip.\n\n
 *   Ears: forward early, rotated outward by the end.\n\n
 *   ...
 *
 * We split on `\n\n+`, then for each section detect the
 * "<Label>: <content>" prefix and render the label in bold. Sections
 * that don't match the label pattern (defensive — stale model output,
 * legacy cached observations) render as plain body text.
 *
 * Used on:
 *   - app/behavior.tsx (live "done" screen)
 *   - app/behavior-history.tsx (past-reading detail)
 *
 * Lives here (not next to behavior.tsx) so the history screen can
 * reuse it without importing app-route code, which Expo Router
 * doesn't love.
 */
import { View } from 'react-native';
import { Text } from './Text';
import { space } from '../theme/tokens';

export function ObservationBody({ text }: { text: string }) {
  const sections = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <View>
      {sections.map((section, i) => {
        const match = section.match(/^([A-Z][a-zA-Z\s]+?):\s+([\s\S]+)$/);
        const isFirst = i === 0;
        const sharedStyle = {
          lineHeight: 22,
          marginTop: isFirst ? 0 : space[3],
        };
        if (match) {
          const [, label, rest] = match;
          return (
            <Text key={i} token="body" style={sharedStyle}>
              <Text style={{ fontFamily: 'Figtree_700Bold' }}>{label}: </Text>
              {rest}
            </Text>
          );
        }
        return (
          <Text key={i} token="body" style={sharedStyle}>
            {section}
          </Text>
        );
      })}
    </View>
  );
}
