/**
 * Button — primary / secondary / ghost variants.
 * Specs in docs/design-system.md §7.
 *
 * One primary action per screen (Umax / Cal AI viral playbook).
 * 48×48 minimum tap target.
 */
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import { Text } from './Text';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

const HEIGHTS = { sm: 36, md: 48, lg: 56 } as const;
const H_PADDING = { sm: 12, md: 20, lg: 24 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  pill,
  disabled,
  fullWidth,
  leftIcon,
  rightIcon,
  style,
  testID,
}: ButtonProps) {
  const t = useTheme();

  const baseStyle: ViewStyle = {
    height: HEIGHTS[size],
    paddingHorizontal: H_PADDING[size],
    borderRadius: pill ? radius.full : radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    minWidth: fullWidth ? undefined : 48,
    minHeight: 48,
  };

  const bgByVariant = {
    primary: t.primary500,
    secondary: t.surfaceElevated,
    ghost: 'transparent',
  }[variant];

  const borderByVariant = {
    primary: undefined,
    secondary: { borderWidth: 1, borderColor: t.borderStrong },
    ghost: undefined,
  }[variant];

  const textColor =
    variant === 'primary'
      ? 'textInverse'
      : variant === 'ghost'
        ? 'primary700'
        : 'textPrimary';

  const onPressed = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPressed}
      style={({ pressed }) => [
        baseStyle,
        { backgroundColor: bgByVariant },
        borderByVariant,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leftIcon ? <View>{leftIcon}</View> : null}
      <Text
        token={size === 'lg' ? 'bodyLg' : 'body'}
        color={textColor}
        style={styles.label}
      >
        {label}
      </Text>
      {rightIcon ? <View>{rightIcon}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  label: { fontWeight: '600' },
});
