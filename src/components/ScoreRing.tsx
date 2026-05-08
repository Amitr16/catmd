/**
 * ScoreRing — the single most important visual in the app (Umax playbook).
 *
 * Animation: we drive Skia's native `end` prop with a Reanimated
 * `SharedValue`. Skia 1.x subscribes to shared values directly, so we
 * do NOT wrap Path in `Animated.createAnimatedComponent` — that's for
 * native host views, not Skia's declarative primitives.
 */
import React from 'react';
import { AccessibilityInfo, View, type ViewStyle } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { urgencyTier, tierFromScore, type UrgencyTier } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';
import { haptic } from '../theme/haptics';

export type ScoreRingProps = {
  score: number;
  size?: number;           // default 160 (profile) / 96 (list)
  strokeWidth?: number;
  animate?: boolean;
  style?: ViewStyle;
};

function buildFullCircle(cx: number, cy: number, r: number) {
  const path = Skia.Path.Make();
  path.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, -90, 360);
  return path;
}

export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
  animate = true,
  style,
}: ScoreRingProps) {
  const t = useTheme();
  const tier = tierFromScore(score);
  const meta = urgencyTier[tier];
  const arcColor = t[meta.token];

  const target = Math.max(0, Math.min(1, score / 100));
  // SharedValue is consumed directly by Skia's <Path end={...}> prop.
  const end = useSharedValue(animate ? 0 : target);

  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    if (!animate) {
      end.value = target;
      return;
    }
    const duration = reduceMotion ? 150 : 800;
    end.value = withTiming(target, {
      duration,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
    const id = setTimeout(() => haptic.urgencyReveal(tier as UrgencyTier), duration);
    return () => clearTimeout(id);
  }, [animate, reduceMotion, target, tier, end]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const path = React.useMemo(() => buildFullCircle(cx, cy, r), [cx, cy, r]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: score }}
      accessibilityLabel={`Cat health score: ${score} out of 100, ${meta.label} tier`}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Canvas style={{ width: size, height: size, position: 'absolute' }}>
        {/* Track ring */}
        <Path
          path={path}
          color={t.borderSubtle}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          start={0}
          end={1}
        />
        {/* Animated arc — Skia reads `end` from the SharedValue directly */}
        <Path
          path={path}
          color={arcColor}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          start={0}
          end={end}
        />
      </Canvas>
      <Text token="score" style={{ color: t.textPrimary }}>
        {Math.round(score)}
      </Text>
      <Text token="caption" color="textMuted" style={{ marginTop: -4 }}>
        Health score
      </Text>
    </View>
  );
}
