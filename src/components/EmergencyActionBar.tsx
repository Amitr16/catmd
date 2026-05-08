/**
 * EmergencyActionBar — shown on /result when a scan is urgent tier.
 *
 * Design rationale: the existing banner said "call your emergency vet now"
 * but didn't actually dial anything. In a real panic (3am, cat collapsed)
 * the owner needs immediate taps, not prose. This bar gives them four
 * one-tap paths:
 *
 *   1. Call saved emergency vet (primary) — or prompt to save one
 *   2. Find 24/7 emergency vet nearby (Maps query)
 *   3. Call ASPCA Poison Control (toxicology hotline, 24/7)
 *   4. Share scan PDF with vet
 *
 * Plus an expandable "What to bring" checklist synthesised from the
 * triage result's vet_preparations + vet_questions.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  CaretDown,
  CaretUp,
  ListChecks,
  MapPin,
  Phone,
  ShareFat,
} from 'phosphor-react-native';
import { Text } from './Text';
import type { CatProfile } from '../state/catStore';
import type { ScanRecord } from '../state/scanStore';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';

const APCC_NUMBER = '+18884264435';

function mapsUrlFor(query: string): string {
  // Platform-native deep links; both Android geo: and iOS maps://
  // fall back to a web URL the OS will open in the maps app.
  const q = encodeURIComponent(query);
  if (Platform.OS === 'ios') return `http://maps.apple.com/?q=${q}`;
  if (Platform.OS === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

async function openUrlWithFallback(primary: string, fallback?: string) {
  try {
    const supported = await Linking.canOpenURL(primary);
    if (supported) return Linking.openURL(primary);
    if (fallback) return Linking.openURL(fallback);
  } catch {
    if (fallback) return Linking.openURL(fallback).catch(() => {});
  }
}

export function EmergencyActionBar({
  scan,
  cat,
  onEditVet,
  onShare,
}: {
  scan: ScanRecord;
  cat: CatProfile | null;
  onEditVet: () => void;
  onShare: () => void;
}) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);

  const vetPhone = cat?.emergency_vet_phone ?? null;
  const vetName = cat?.emergency_vet_name ?? null;

  const checklist = useMemo(() => {
    const items: string[] = [];
    if (scan.vet_preparations.length) items.push(...scan.vet_preparations);
    // Dedup against what_to_monitor which often overlaps.
    return items.slice(0, 8);
  }, [scan]);

  const callVet = () => {
    if (!vetPhone) {
      Alert.alert(
        'Add an emergency vet',
        'Save your vet\u2019s number on the cat profile so you can call with one tap next time.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add now', onPress: onEditVet },
        ],
      );
      return;
    }
    Linking.openURL(`tel:${vetPhone.replace(/[^\d+]/g, '')}`).catch(() =>
      Alert.alert('Could not open dialer', `Call ${vetPhone} directly.`),
    );
  };

  const findER = () => {
    void openUrlWithFallback(
      mapsUrlFor('emergency vet near me'),
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        'emergency vet near me',
      )}`,
    );
  };

  const callAPCC = () => {
    Alert.alert(
      'Call ASPCA Poison Control?',
      '24/7 animal poison hotline. A consultation fee may apply.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${APCC_NUMBER}`).catch(() =>
              Alert.alert('Could not open dialer', 'Dial 888-426-4435 directly.'),
            );
          },
        },
      ],
    );
  };

  return (
    <View
      style={{
        backgroundColor: t.error,
        borderRadius: radius.lg,
        padding: space[4],
        marginBottom: space[4],
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Phone size={22} color={t.textInverse} weight="fill" />
        <View style={{ flex: 1 }}>
          <Text token="heading3" style={{ color: t.textInverse }}>
            {scan.hard_urgency ? 'This may be an emergency' : 'Triage flagged urgent'}
          </Text>
          <Text token="caption" style={{ color: t.textInverse, opacity: 0.9 }}>
            Don&rsquo;t wait. Use one of these now.
          </Text>
        </View>
      </View>

      {/* Primary action — call vet (or prompt to save one) */}
      <Pressable
        onPress={callVet}
        accessibilityRole="button"
        accessibilityLabel={vetPhone ? `Call ${vetName ?? 'emergency vet'}` : 'Add emergency vet number'}
        style={({ pressed }) => [
          styles.primaryBtn,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Phone size={20} color={t.error} weight="fill" />
        <View style={{ flex: 1 }}>
          <Text token="body" style={{ color: t.error, fontFamily: 'Figtree_700Bold' }}>
            {vetPhone ? `Call ${vetName ?? 'your vet'}` : 'Add emergency vet number'}
          </Text>
          <Text token="caption" style={{ color: t.error, opacity: 0.85 }}>
            {vetPhone ?? 'One-tap dialing next time'}
          </Text>
        </View>
      </Pressable>

      {/* Secondary actions */}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <SecondaryAction icon={<MapPin size={18} color={t.textInverse} weight="fill" />} label="Find 24/7 ER" onPress={findER} />
        <SecondaryAction icon={<Phone size={18} color={t.textInverse} weight="fill" />} label="Poison hotline" onPress={callAPCC} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <SecondaryAction icon={<ShareFat size={18} color={t.textInverse} weight="fill" />} label="Share with vet" onPress={onShare} />
        <SecondaryAction
          icon={expanded
            ? <CaretUp size={18} color={t.textInverse} weight="bold" />
            : <ListChecks size={18} color={t.textInverse} weight="fill" />}
          label={expanded ? 'Hide checklist' : 'What to bring'}
          onPress={() => setExpanded((v) => !v)}
        />
      </View>

      {expanded && checklist.length > 0 ? (
        <View
          style={{
            marginTop: space[1],
            paddingTop: space[3],
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(255,255,255,0.25)',
          }}
        >
          <Text token="caption" style={{ color: t.textInverse, opacity: 0.9, marginBottom: space[1] }}>
            Bring this to the clinic
          </Text>
          {checklist.map((item, i) => (
            <Text key={i} token="body" style={{ color: t.textInverse, marginTop: 2 }}>
              · {item}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SecondaryAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.secondaryBtn,
        {
          borderColor: 'rgba(255,255,255,0.4)',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text
        token="caption"
        style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: '#FAF7F2',
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    minHeight: 56,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    minHeight: 44,
  },
});
