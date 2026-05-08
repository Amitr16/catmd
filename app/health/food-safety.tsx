/**
 * Food / plant / drug / household safety lookup.
 *
 * The 2am "did my cat just eat something bad?" screen. We ship a curated
 * dataset offline so it works without internet at the worst possible
 * moment. Toxic and caution results get an obvious red/amber treatment and
 * one-tap access to the APCC hotline.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle,
  FirstAid,
  MagnifyingGlass,
  Phone,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import {
  SAFETY_DB,
  searchSafety,
  type SafetyCategory,
  type SafetyItem,
  type SafetyVerdict,
} from '../../src/data/foodSafety';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

const APCC_NUMBER = '+18884264435'; // ASPCA Animal Poison Control Center

const CATEGORIES: { key: SafetyCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'plant', label: 'Plants' },
  { key: 'drug', label: 'Drugs' },
  { key: 'household', label: 'Household' },
];

export default function FoodSafetyScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SafetyCategory | 'all'>('all');
  const [selected, setSelected] = useState<SafetyItem | null>(null);

  const results = useMemo(() => {
    const base = query.trim()
      ? searchSafety(query, 24)
      : [...SAFETY_DB].sort((a, b) => a.name.localeCompare(b.name));
    return filter === 'all' ? base : base.filter((i) => i.category === filter);
  }, [query, filter]);

  const callAPCC = () => {
    Alert.alert(
      'Call ASPCA Poison Control?',
      '24/7 animal poison hotline. A consultation fee may apply.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${APCC_NUMBER}`).catch(() => {
              Alert.alert('Could not open dialer', 'Dial 888-426-4435 directly.');
            });
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <FirstAid size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Is this safe?</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          Look up foods, plants, human meds, and household items. Works offline
          in case of an emergency.
        </Text>

        {/* Hotline banner */}
        <Pressable
          onPress={callAPCC}
          accessibilityRole="button"
          accessibilityLabel="Call ASPCA Poison Control 24/7 hotline"
          style={({ pressed }) => [
            {
              marginTop: space[4],
              padding: space[4],
              borderRadius: radius.lg,
              backgroundColor: t.error,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Phone size={22} color={t.textInverse} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text token="heading3" style={{ color: t.textInverse }}>
              ASPCA Poison Control — 24/7
            </Text>
            <Text token="caption" style={{ color: t.textInverse, opacity: 0.9, marginTop: 2 }}>
              (888) 426-4435 · Tap to call
            </Text>
          </View>
        </Pressable>

        {/* Search */}
        <View
          style={{
            marginTop: space[4],
            height: 44,
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: t.borderStrong,
            backgroundColor: t.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
          }}
        >
          <MagnifyingGlass size={18} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="lily, chocolate, ibuprofen, tulip…"
            placeholderTextColor={t.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{
              flex: 1,
              color: t.textPrimary,
              fontFamily: 'Figtree_400Regular',
              fontSize: 15,
            }}
          />
        </View>

        {/* Category chips */}
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => {
            const active = filter === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: space[3],
                    height: 32,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: active ? t.primary700 : t.borderStrong,
                    backgroundColor: active ? t.primary700 : t.surface,
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  token="caption"
                  style={{
                    color: active ? t.textInverse : t.textPrimary,
                    fontFamily: 'Figtree_500Medium',
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Results */}
        <View style={{ marginTop: space[4], gap: space[2] }}>
          {results.length === 0 ? (
            <Card>
              <Text token="body" color="textSecondary">
                Nothing matched &ldquo;{query}&rdquo;. If you&rsquo;re worried about an
                ingestion, call the ASPCA hotline — don&rsquo;t wait.
              </Text>
            </Card>
          ) : (
            results.map((item) => (
              <ResultRow
                key={`${item.category}:${item.name}`}
                item={item}
                onPress={() => setSelected(item)}
              />
            ))
          )}
        </View>

        {/* Detail modal replaced by inline sheet at bottom */}
        {selected ? (
          <DetailSheet
            item={selected}
            onClose={() => setSelected(null)}
            onCallAPCC={callAPCC}
          />
        ) : null}

        <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[6] }}>
          Informational only. When in doubt, call your vet or the APCC.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultRow({ item, onPress }: { item: SafetyItem; onPress: () => void }) {
  const t = useTheme();
  const v = verdictTone(item.verdict, t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.verdict}`}
      style={({ pressed }) => [
        {
          borderRadius: radius.md,
          padding: space[4],
          backgroundColor: t.surface,
          borderLeftWidth: 4,
          borderLeftColor: v.color,
          borderWidth: 1,
          borderColor: t.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {v.icon}
      <View style={{ flex: 1 }}>
        <Text token="body" style={{ fontFamily: 'Figtree_600SemiBold' }}>
          {item.name}
        </Text>
        <Text token="caption" color="textMuted" style={{ marginTop: 2, textTransform: 'capitalize' }}>
          {item.category} · {verdictLabel(item.verdict)}
        </Text>
      </View>
    </Pressable>
  );
}

function DetailSheet({
  item,
  onClose,
  onCallAPCC,
}: {
  item: SafetyItem;
  onClose: () => void;
  onCallAPCC: () => void;
}) {
  const t = useTheme();
  const v = verdictTone(item.verdict, t);
  return (
    <Card
      style={{
        marginTop: space[4],
        borderLeftWidth: 4,
        borderLeftColor: v.color,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {v.icon}
        <Text token="heading3" style={{ flex: 1 }}>{item.name}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text token="caption" color="primary700">Close</Text>
        </Pressable>
      </View>
      <Text
        token="caption"
        style={{ color: v.color, marginTop: space[1], fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 }}
      >
        {verdictLabel(item.verdict)}
      </Text>
      <Text token="body" style={{ marginTop: space[2] }}>{item.why}</Text>

      {item.signs && item.signs.length > 0 ? (
        <View style={{ marginTop: space[3] }}>
          <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Signs to watch for
          </Text>
          {item.signs.map((s, i) => (
            <Text key={i} token="body" style={{ marginTop: space[1] }}>
              · {s}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: space[3] }}>
        <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          What to do
        </Text>
        <Text token="body" style={{ marginTop: space[1] }}>{item.what_to_do}</Text>
      </View>

      {item.verdict !== 'safe' ? (
        <Button
          label="Call ASPCA 24/7 hotline"
          onPress={onCallAPCC}
          leftIcon={<Phone size={18} color={t.textInverse} weight="bold" />}
          style={{ marginTop: space[4] }}
        />
      ) : null}
    </Card>
  );
}

function verdictLabel(v: SafetyVerdict): string {
  return v === 'toxic' ? 'Toxic — do not give' : v === 'caution' ? 'Caution' : 'Safe';
}

function verdictTone(v: SafetyVerdict, t: ReturnType<typeof useTheme>) {
  if (v === 'toxic') return { color: t.error, icon: <XCircle size={22} color={t.error} weight="fill" /> };
  if (v === 'caution') return { color: t.warning, icon: <WarningCircle size={22} color={t.warning} weight="fill" /> };
  return { color: t.success, icon: <CheckCircle size={22} color={t.success} weight="fill" /> };
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
});
