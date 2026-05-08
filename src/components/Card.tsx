/**
 * Card — raised surface on the cream canvas. 16 radius, 16 padding, elev 1.
 * Per design-system.md §7.
 */
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { elevation, radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: keyof typeof elevation;
  style?: ViewStyle;
};

export function Card({
  padded = true,
  elevated = 1,
  style,
  children,
  ...rest
}: CardProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surfaceElevated,
          borderRadius: radius.lg,
          padding: padded ? space[4] : 0,
        },
        elevation[elevated],
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
