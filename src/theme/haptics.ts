/**
 * Haptic budget — exactly 4 moments per design-system.md §5.
 *
 *   1. scanCapture    — medium impact on camera shutter press
 *   2. urgencyReveal  — success/warning depending on tier (semantic)
 *   3. milestone      — success (first scan, streak, vet visit logged)
 *   4. errorFeedback  — error (scan failed, network error)
 *
 * Do NOT haptic every button press. Over-haptic = premium app death.
 */
import * as Haptics from 'expo-haptics';
import type { UrgencyTier } from './tokens';

export const haptic = {
  scanCapture: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  urgencyReveal: (tier: UrgencyTier) => {
    const t =
      tier === 'urgent' || tier === 'concern'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;
    return Haptics.notificationAsync(t);
  },

  milestone: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  errorFeedback: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
} as const;
