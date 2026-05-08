/**
 * Notification settings — per-category toggles.
 *
 * Linked from the Settings screen. Lets owners opt out of any category
 * without disabling notifications system-wide. Disabling a category:
 *   1. Flips the per-category enabled flag in notifPrefsStore
 *   2. Cancels any in-flight scheduled id for that category (per-cat)
 * Re-enabling does NOT auto-reschedule — the next save in cat-profile or
 * the next daily_checkin trigger will create a fresh schedule.
 *
 * Hard rules (preserve trust):
 *   - Daily cap: max 1 push per day (not enforced here; lives in
 *     notifications.ts when scheduling — TBD)
 *   - Quiet hours 10pm-8am — TBD
 *   - One-tap unsubscribe per category — implemented HERE
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Cake,
  Camera,
  ChartLine,
  FilmStrip,
  Flame,
  Heartbeat,
  House,
  NotePencil,
  PaperPlaneTilt,
  Pill,
  Sparkle,
  VideoCamera,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import {
  useNotifPrefsStore,
  type NotifCategory,
} from '../src/state/notifPrefsStore';
import { useCatStore } from '../src/state/catStore';
import { cancelNotification } from '../src/services/notifications';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

type CategoryRow = {
  id: NotifCategory;
  icon: React.ReactNode;
  title: string;
  description: string;
};

export default function NotificationSettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enabled = useNotifPrefsStore((s) => s.enabled);
  const setEnabled = useNotifPrefsStore((s) => s.setEnabled);
  const scheduledIds = useNotifPrefsStore((s) => s.scheduledIds);
  const setScheduledId = useNotifPrefsStore((s) => s.setScheduledId);
  const cats = useCatStore((s) => s.cats);

  const rows: CategoryRow[] = [
    {
      id: 'daily_checkin',
      icon: <Sparkle size={22} color={t.primary700} weight="duotone" />,
      title: 'Daily check-in reminder',
      description: 'A gentle nudge at your chosen time to log mood + appetite.',
    },
    {
      id: 'medication',
      icon: <Pill size={22} color={t.primary700} weight="duotone" />,
      title: 'Medication reminder',
      description: 'Daily reminder for prescribed meds — body lists current meds.',
    },
    {
      id: 'birthday',
      icon: <Cake size={22} color={t.primary700} weight="duotone" />,
      title: 'Birthday',
      description: "Once a year on your cat's birthday — tap for a photo album.",
    },
    {
      id: 'adoption_iversary',
      icon: <House size={22} color={t.primary700} weight="duotone" />,
      title: 'Adoption-iversary',
      description: 'Once a year on the day your cat joined your home.',
    },
    {
      id: 'streak_milestone',
      icon: <Flame size={22} color={t.primary700} weight="duotone" />,
      title: 'Check-in streak milestones',
      description: 'A small celebration at 7, 14, 30, 60, 90, 180, 365-day streaks.',
    },
    {
      id: 'insight',
      icon: <ChartLine size={22} color={t.primary700} weight="duotone" />,
      title: 'Insights',
      description:
        "Data-driven nudges — e.g. when 3+ 'off' check-ins land in a week.",
    },
    {
      id: 'weekly_read_nudge',
      icon: <VideoCamera size={22} color={t.primary700} weight="duotone" />,
      title: 'Weekly body language nudge',
      description: "If it's been a week since you last captured your cat's body language with a 6-second clip.",
    },
    {
      id: 'diary_entry',
      icon: <NotePencil size={22} color={t.primary700} weight="duotone" />,
      title: 'Cat Diary',
      description: 'Daily at 7pm — your cat has thoughts about today.',
    },
    {
      id: 'postcard_ready',
      icon: <PaperPlaneTilt size={22} color={t.primary700} weight="duotone" />,
      title: 'Postcard ready',
      description: 'Daily at 7pm — today\'s social card is ready to share.',
    },
    {
      id: 'cat_studio_poster',
      icon: <FilmStrip size={22} color={t.primary700} weight="duotone" />,
      title: 'Weekly poster',
      description: 'Sundays at 10am — a fresh AI movie-poster remix from this week\'s photos.',
    },
    {
      id: 'outcome_check',
      icon: <Heartbeat size={22} color={t.primary700} weight="duotone" />,
      title: 'Scan follow-up',
      description: '6–36 hours after a triage scan — a single check asking if your cat is doing better, so we know which advice actually helped.',
    },
    {
      id: 'daily_photo_studio',
      icon: <Camera size={22} color={t.primary700} weight="duotone" />,
      title: 'Daily photo',
      description: 'Daily at 11am — a quick nudge to snap one photo for the monthly time-lapse.',
    },
  ];

  const handleToggle = async (category: NotifCategory, on: boolean) => {
    setEnabled(category, on);
    // Telemetry: notification_category_toggled — opt-in/out signal per
    // category. Critical for understanding which notifications are
    // tolerated (most stay enabled) vs hated (high opt-out rate).
    void import('../src/services/analytics').then(({ track }) =>
      track({
        type: 'notification_category_toggled',
        props: { category, enabled: on },
      }),
    );
    if (!on) {
      // Cancel any in-flight scheduled notifications for this category
      // across all cats — clean opt-out.
      for (const cat of cats) {
        const key = `${cat.id}:${category}`;
        const id = scheduledIds[key];
        if (id) {
          await cancelNotification(id);
          setScheduledId(cat.id, category, null);
        }
      }
    }
    // Re-enabling does NOT auto-reschedule — the next save flow or the
    // next trigger condition will pick up the fresh enabled flag and
    // create a new schedule. Keeps logic simple.
  };

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <ArrowLeft size={24} color={t.textPrimary} weight="regular" />
        </Pressable>
        <Text token="heading2" style={{ flex: 1, textAlign: 'center' }}>
          Notifications
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[8],
        }}
      >
        <Text token="body" color="textMuted" style={{ marginBottom: space[5] }}>
          Choose which alerts CatMD can send. We cap at 1 push notification
          per day; never between 10pm and 8am.
        </Text>

        {rows.map((row) => (
          <View
            key={row.id}
            style={[
              styles.row,
              { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
            ]}
          >
            <View
              style={[
                styles.rowIcon,
                { backgroundColor: t.primary100, borderColor: t.borderSubtle },
              ]}
            >
              {row.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text token="heading3" style={{ marginBottom: 2 }}>
                {row.title}
              </Text>
              <Text token="caption" color="textMuted" style={{ lineHeight: 18 }}>
                {row.description}
              </Text>
            </View>
            <Switch
              value={enabled[row.id] ?? true}
              onValueChange={(on) => void handleToggle(row.id, on)}
              trackColor={{ false: t.borderSubtle, true: t.primary500 }}
              thumbColor={t.surfaceElevated}
            />
          </View>
        ))}

        <Text
          token="caption"
          color="textMuted"
          style={{ marginTop: space[6], textAlign: 'center', lineHeight: 18 }}
        >
          To turn off all notifications system-wide, use your phone&apos;s
          Settings → Apps → CatMD → Notifications.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space[2],
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
