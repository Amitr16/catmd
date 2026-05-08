/**
 * Main group — 4-tab bottom navigation.
 *
 * Tabs (ordered to lead with the bond/relational surfaces, with Triage at
 * the right end — putting Triage last keeps the brand from reading as
 * "triage app" the moment you open it; Triage is one capability of the
 * "your cat's MD" platform, not its identity):
 *   - Today (index): daily ritual surface — score, check-ins, behaviour
 *   - Bond: emotional/creative layer — diary, companion, studio
 *   - Chat: AI cat companion (mostly coming soon)
 *   - Triage: medical entry point — scan + Track + Watch + library
 *
 * 5th "Insights" tab reserved for when Sleep Coach + Meow decoder + trend
 * graphs land and need their own surface (active-tasks → prod-platform-vision-2026).
 *
 * Detail screens (scan, result, behavior, cat-profile, paywall, etc.) stay
 * outside the tab group and are pushed via expo-router from any tab.
 */
import { Tabs } from 'expo-router';
import { ChatCircle, House, Stethoscope, Sparkle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';

export default function MainLayout() {
  const t = useTheme();
  // Edge-to-edge mode (app.json `edgeToEdgeEnabled: true`) makes the Android
  // system nav bar transparent and overlapping. Without explicit safe-area
  // padding the tab bar renders UNDERNEATH the system nav and the labels
  // get hidden behind back/home/recents icons. Add the bottom inset so the
  // tab bar floats above the system nav cleanly.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary700,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          backgroundColor: t.surfaceElevated,
          borderTopColor: t.borderSubtle,
          borderTopWidth: 1,
          // 64 = base tab height; insets.bottom = whatever Android system nav needs
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Figtree_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <House size={24} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="bond"
        options={{
          title: 'Bond',
          tabBarIcon: ({ color, focused }) => (
            <Sparkle size={24} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <ChatCircle size={24} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
          // Hide the tab bar when the keyboard is open. Chat is the
          // only tab with a persistent text input pinned to the
          // bottom; without this, the 64+inset.bottom-tall tab bar
          // overlaps the composer when the keyboard pushes content
          // up via Android's adjustResize, leaving the input
          // partially or fully hidden behind the keyboard.
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen
        name="triage"
        options={{
          title: 'Triage',
          tabBarIcon: ({ color, focused }) => (
            <Stethoscope size={24} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      {/* Cat profile + multi-cat + subscription + family sharing all live
          under Settings (gear icon on Today tab) — having a separate Cat
          tab was redundant. The cat.tsx file is hidden from the tab bar
          but kept in the project so deep links to /cat (if any) don't
          break. Hide via `href: null`. */}
      <Tabs.Screen name="cat" options={{ href: null }} />
    </Tabs>
  );
}
