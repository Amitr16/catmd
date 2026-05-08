/**
 * Root layout — fonts, theme, query-client, gesture handler root.
 * Routes:
 *   /                  → redirects to onboarding or (main)
 *   /onboarding        → 3-slide new-cat-parent flow
 *   /(main)            → stack containing home + nested screens
 *   /scan              → camera + free-text triage input
 *   /result            → structured triage output
 *   /cat-profile       → editable cat profile
 */
import 'react-native-reanimated';
import '../src/services/supabase'; // eagerly init Supabase client

import { LogBox } from 'react-native';
import { ensureSession } from '../src/services/auth';
import { initializePurchases } from '../src/services/purchases';

// expo-notifications SDK 53+ removed Android *push* token support in Expo
// Go. We only use LOCAL scheduled notifications so the warning is noise.
// It goes away automatically in a dev client / production build.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import {
  Figtree_300Light,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

export default function RootLayout() {
  const theme = useTheme();
  const router = useRouter();

  // Bootstrap auth + purchases once, before any screen mounts.
  // Wrapped in try/catch so a misconfigured Supabase project (e.g.
  // anonymous auth disabled) never blocks the app from rendering.
  useEffect(() => {
    (async () => {
      try {
        const session = await ensureSession();
        if (session?.user?.id) {
          await initializePurchases(session.user.id).catch(() => {});
          // Backfill any local cats that never made it to Supabase (e.g.
          // created before the UUID→text schema migration). Without this,
          // subsequent scan/event syncs fail the FK check to cats.id.
          const { useCatStore } = await import('../src/state/catStore');
          const { backfillCatsToCloud } = await import('../src/services/sync');
          void backfillCatsToCloud(useCatStore.getState().cats).catch(() => {});
        }
        // Analytics: emit the session-open event and identify the user
        // by their stable auth uid so anonymous-then-email-upgrade flows
        // collapse to one person profile in PostHog.
        const { identify, track } = await import('../src/services/analytics');
        track({ type: 'app_opened' });
        if (session?.user?.id) identify(session.user.id);

        // Conscious diary: backfill missing entries for the active cat on
        // every cold start. This is the engine that makes the diary feel
        // *alive* — even when the user doesn't open the screen for days,
        // the cat still keeps a daily journal (populated on activity-days,
        // melancholic on quiet ones). The store caps backfill at 30 days
        // and is idempotent, so this is safe to call on every boot.
        try {
          const { useCatStore } = await import('../src/state/catStore');
          const { useDiaryStore } = await import('../src/state/diaryStore');
          const activeCatId = useCatStore.getState().activeCatId;
          if (activeCatId) {
            void useDiaryStore
              .getState()
              .backfillMissingEntries(activeCatId)
              .catch((err) => {
                console.warn('[CatMD] diary backfill failed:', err);
              });
          }
        } catch (e) {
          console.warn('[CatMD] diary backfill init failed:', e);
        }
      } catch (e) {
        console.warn('[CatMD] bootstrap failed:', e);
      }
    })();
  }, []);

  // Route notification taps to the right screen. Handles both cold starts
  // and warm taps. `expo-notifications` is dynamic-imported because its
  // top-level side effects crash Expo Go on Android (SDK 53+ removed
  // remote-push support); in Expo Go we skip the listener entirely so the
  // app still boots.
  //
  // History: the previous version of this handler had three bugs that
  // manifested as a "tap notification → splash → freeze" report from a
  // beta tester:
  //   1. SCHEMA MISMATCH — handler only knew `data.type`. Newer
  //      notifications (diary, postcard, birthday, etc.) use
  //      `data.route` and were silent no-ops.
  //   2. WRONG DESTINATION — "How is Lily doing?" check-in reminders
  //      routed to /scan (the symptom-scanner) instead of Today (where
  //      the check-in card lives).
  //   3. COLD-START RACE — `router.push()` fired synchronously in
  //      useEffect before the expo-router navigator was mounted. On
  //      cold start the push could no-op silently or hang.
  //
  // Fix:
  //   - Support BOTH schemas: `data.route` (preferred, all new code)
  //     AND legacy `data.type` (fallback for old setCheckinReminder /
  //     setMedReminder schedules still in flight on older devices).
  //   - Route checkin → /(main) (Today screen) not /scan.
  //   - Defer router.push via requestAnimationFrame so the navigator
  //     has at least one frame to mount before we navigate.
  //   - Wrap routeFromData in try/catch so any future bug in routing
  //     code can never freeze the splash. Worst case: app boots to
  //     /(main) instead of the deep-linked screen.
  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    const safePush = (target: Parameters<typeof router.push>[0]) => {
      // Defer to the next frame so the navigator has a chance to mount
      // on cold-start. Wrap in try/catch as ultimate safety: if
      // navigation throws, we'd rather the user land on /(main) than
      // freeze on the splash.
      requestAnimationFrame(() => {
        try {
          router.push(target);
        } catch (e) {
          console.warn('[CatMD] notification deep-link push failed:', e);
        }
      });
    };

    const routeFromData = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;

        // Preferred schema (new) — `data.route` is set on all
        // notifications added since the rebrand: diary, postcard,
        // birthday, adoption-iversary, streak, insight,
        // weekly-read-nudge.
        if (typeof d.route === 'string' && d.route.length > 0) {
          safePush(d.route as never);
          return;
        }

        // Legacy schema fallback — `data.type` was used by the
        // original setCheckinReminder / setMedReminder schedules.
        // Keep this branch alive: notifications already in the
        // device's queue from older app versions still use it.
        switch (d.type) {
          case 'outcome_check':
            if (typeof d.scanId === 'string') {
              safePush({
                pathname: '/outcome-check',
                params: { scanId: d.scanId },
              });
            }
            return;
          case 'checkin':
            // Land on Today — that's where the daily check-in card
            // lives. Previously routed to /scan, which was the wrong
            // destination AND triggered a cold-start hang via
            // /scan's quota / auth / cat gates.
            safePush('/(main)' as never);
            return;
          case 'med':
            safePush('/health/medications' as never);
            return;
        }
      } catch (e) {
        // Swallow — never let the deep-link handler crash the splash.
        console.warn('[CatMD] notification routeFromData error:', e);
      }
    };

    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) routeFromData(last.notification.request.content.data);
        const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          routeFromData(resp.notification.request.content.data);
        });
        removeListener = () => sub.remove();
      } catch (e) {
        // Expo Go on Android or unsupported env — silently skip.
        console.warn('[CatMD] notification handler init skipped:', e);
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // Hide splash on EITHER successful font load OR font error — never block the
  // app on a flaky-network font fetch. If fonts fail (CDN unreachable, slow
  // 3G, etc.), system fonts fall back automatically; splash must still hide.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={{ flex: 1, backgroundColor: theme.surface }}>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: theme.surface },
                headerStyle: { backgroundColor: theme.surface },
                headerTitleStyle: { fontFamily: 'SourceSerif4_500Medium' },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(main)" options={{ headerShown: false }} />
              <Stack.Screen
                name="scan"
                options={{ title: 'Scan', presentation: 'card' }}
              />
              <Stack.Screen
                name="result"
                options={{ title: 'Triage', presentation: 'card' }}
              />
              <Stack.Screen
                name="cat-profile"
                options={{ title: 'Cat profile', presentation: 'card' }}
              />
              <Stack.Screen
                name="personality"
                options={{ title: 'Personality', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="diary"
                options={{ title: 'Diary', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="cat-studio"
                options={{ title: 'Posters', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="postcard"
                options={{ title: 'Postcard', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="photo-studio"
                options={{ title: 'Photos', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="health-rhythm"
                options={{ title: 'Health Rhythm', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="cats"
                options={{ title: 'Your cats', presentation: 'card' }}
              />
              <Stack.Screen
                name="people"
                options={{ title: 'People & Pets', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="becoming"
                options={{ title: 'Becoming', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="health/index"
                options={{ title: 'Health', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/vaccinations"
                options={{ title: 'Vaccinations', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/medications"
                options={{ title: 'Medications', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/weight"
                options={{ title: 'Weight', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/appointments"
                options={{ title: 'Appointments', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/symptom-timeline"
                options={{ title: 'Symptom timeline', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/summary"
                options={{ title: '12-month report', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/food-safety"
                options={{ title: 'Is this safe?', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/articles"
                options={{ title: 'Library', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/article"
                options={{ title: 'Article', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/srr"
                options={{ title: 'Breath count', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/litter"
                options={{ title: 'Litter box', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/ckd"
                options={{ title: 'CKD watch', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/hyperthyroid"
                options={{ title: 'Thyroid watch', presentation: 'card' }}
              />
              <Stack.Screen
                name="health/pain"
                options={{ title: 'Pain check', presentation: 'card' }}
              />
              <Stack.Screen
                name="follow-up"
                options={{ title: 'Sharpen triage', presentation: 'card' }}
              />
              <Stack.Screen
                name="settings"
                options={{ title: 'Settings', presentation: 'card' }}
              />
              <Stack.Screen
                name="outcome-check"
                options={{ title: 'Check-in', presentation: 'card' }}
              />
              <Stack.Screen
                name="upgrade-account"
                options={{ title: 'Add email', presentation: 'card' }}
              />
              <Stack.Screen
                name="paywall"
                options={{ title: '', presentation: 'modal', headerShown: false }}
              />
              {/* Routes deep-linked from notifications. Each ships with
                  its own in-screen header, so we explicitly opt out of
                  the default expo-router navigation header to avoid
                  double-headers when the user taps the notification. */}
              <Stack.Screen
                name="cat-birthday"
                options={{ title: 'Birthday', presentation: 'card', headerShown: false }}
              />
              <Stack.Screen
                name="behavior"
                options={{ title: 'Body Language', presentation: 'card', headerShown: false }}
              />
            </Stack>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
