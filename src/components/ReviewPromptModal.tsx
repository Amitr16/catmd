/**
 * ReviewPromptModal — the "earned" review-prompt modal.
 *
 * Renders once globally (mounted in the root layout). Visibility is
 * driven by services/reviewPrompt.ts which subscribes to feature fire
 * sites and only flips visible=true when the spec's eligibility rule
 * is satisfied — see services/reviewPrompt.ts for the rule detail.
 *
 * Copy: "Did CatMD help you see your cat a little more clearly? A short
 * review helps other cat people find it too." — matches CatMD's
 * positioning rather than reading as a growth-hack prompt.
 *
 * On "Leave a review" tap we fire Google's in-app review API (via
 * expo-store-review). That dialog is Google-throttled so the same user
 * will not see it more than ~1/yr regardless of how many times the
 * code path runs. Our own cooldown rules layer on top of that.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Star } from 'phosphor-react-native';
import { Text } from './Text';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import {
  requestNativeReview,
  useReviewPromptVisibility,
} from '../services/reviewPrompt';
import { useReviewPromptStore } from '../state/reviewPromptStore';
import { track } from '../services/analytics';

export function ReviewPromptModal() {
  const t = useTheme();
  const visible = useReviewPromptVisibility((s) => s.visible);
  const lastInsightType = useReviewPromptVisibility((s) => s.lastInsightType);
  const hide = useReviewPromptVisibility((s) => s.hide);

  const onLeaveReview = async () => {
    const s = useReviewPromptStore.getState();
    try {
      track({
        type: 'review_prompt_clicked',
        props: {
          destination: 'google_play',
          meaningful_sessions_count: s.meaningfulSessionCount,
          useful_insights_count: s.usefulInsightCount,
          last_insight_type: lastInsightType ?? 'unknown',
        },
      });
    } catch {
      // analytics best-effort
    }
    useReviewPromptStore.getState().markClicked();
    hide();
    // Fire native dialog AFTER hiding our own modal so the user sees
    // a clean transition. Best-effort — if expo-store-review isn't
    // available, the click intent is already recorded.
    await requestNativeReview();
  };

  const onDismiss = () => {
    const s = useReviewPromptStore.getState();
    try {
      track({
        type: 'review_prompt_dismissed',
        props: {
          meaningful_sessions_count: s.meaningfulSessionCount,
          useful_insights_count: s.usefulInsightCount,
          last_insight_type: lastInsightType ?? 'unknown',
        },
      });
    } catch {
      // analytics best-effort
    }
    useReviewPromptStore.getState().markDismissed();
    hide();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.borderSubtle }]}>
          <View style={styles.iconWrap}>
            <Star size={32} color={t.primary700} weight="duotone" />
          </View>
          <Text token="heading2" style={{ textAlign: 'center', marginBottom: space[2] }}>
            Did CatMD help you see your cat a little more clearly?
          </Text>
          <Text token="body" color="textSecondary" style={{ textAlign: 'center', lineHeight: 22 }}>
            A short review helps other cat people find it too.
          </Text>
          <View style={{ width: '100%', marginTop: space[5], gap: space[2] }}>
            <Pressable
              onPress={onLeaveReview}
              accessibilityRole="button"
              accessibilityLabel="Leave a review"
              style={[styles.btnPrimary, { backgroundColor: t.primary700 }]}
            >
              <Text token="body" style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}>
                Leave a review
              </Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={[styles.btnSecondary, { borderColor: t.borderSubtle }]}
            >
              <Text token="body" color="textSecondary">
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space[6],
    paddingHorizontal: space[5],
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: space[3],
  },
  btnPrimary: {
    paddingVertical: space[3],
    borderRadius: radius.full,
    alignItems: 'center',
  },
  btnSecondary: {
    paddingVertical: space[3],
    borderRadius: radius.full,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
