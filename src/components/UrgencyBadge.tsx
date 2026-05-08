/**
 * UrgencyBadge — 4-tier pill. NEVER color-alone (icon + label + color).
 * WCAG 1.4.1 compliance. See design-system.md §7.
 */
import { View, type ViewStyle } from 'react-native';
import { CheckCircle, Eye, Flag, WarningCircle } from 'phosphor-react-native';
import { urgencyTier, type UrgencyTier, radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export type UrgencyBadgeProps = {
  tier: UrgencyTier;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

const ICON = {
  routine: CheckCircle,
  monitor: Eye,
  concern: Flag,
  urgent: WarningCircle,
} as const;

export function UrgencyBadge({ tier, size = 'md', style }: UrgencyBadgeProps) {
  const t = useTheme();
  const meta = urgencyTier[tier];
  const IconComp = ICON[tier];
  const iconSize = size === 'sm' ? 14 : 16;

  // Pill palettes: each tier uses an accent + paired text colour from
  // the design tokens. We keep concern + urgent pegged to the
  // terracotta/error semantic ramp; routine + monitor use the calm sage
  // and warm-amber pairs. Previous version hard-coded #F5E8CC / #6B4F14
  // / #F2D3CC for monitor + urgent — those weren't in tokens.ts and
  // drifted from the design system. Now using primary50 (cream-sage)
  // for monitor backgrounds + secondary50 (cream-terracotta) for
  // concern/urgent — both already exist in light + dark token sets.
  const pal = {
    routine: { bg: t.primary100,   fg: t.primary700 },
    monitor: { bg: t.primary50,    fg: t.warning },
    concern: { bg: t.secondary50,  fg: t.secondary700 },
    urgent:  { bg: t.secondary100, fg: t.error },
  }[tier];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Urgency: ${meta.label}. ${meta.copy}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          paddingHorizontal: size === 'sm' ? space[2] : space[3],
          paddingVertical: size === 'sm' ? 3 : space[1],
          borderRadius: radius.full,
          backgroundColor: pal.bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <IconComp size={iconSize} color={pal.fg} weight={tier === 'urgent' ? 'fill' : 'regular'} />
      <Text token="caption" style={{ color: pal.fg }}>
        {meta.label}
      </Text>
    </View>
  );
}
