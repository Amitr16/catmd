/**
 * Cat tab — profile + admin.
 *
 * Edge cases live here, not on the Today/Triage/Bond tabs:
 *   - Cat profile (edit name, breed, age, weight, conditions, meds, photo)
 *   - Multi-cat switcher (when household has >1 cat)
 *   - Family + vet sharing (Phase 3 — coming soon)
 *   - Pet sitter handoff mode (Phase 3 — coming soon)
 *   - Settings (notifications, theme, account)
 *   - Subscription / paywall
 */
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CaretRight,
  Cat as CatIcon,
  Crown,
  Gear,
  House,
  Share,
  Users,
} from 'phosphor-react-native';
import { Text } from '../../src/components/Text';
import { useCatStore, resolveCatAgeYears } from '../../src/state/catStore';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function CatTab() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cats = useCatStore((s) => s.cats);
  const cat = useCatStore((s) => s.cats.find((c) => c.id === s.activeCatId) ?? null);
  const hasMultipleCats = cats.length > 1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + space[5],
        paddingHorizontal: space[5],
        paddingBottom: insets.bottom + space[8],
        gap: space[3],
      }}
    >
      <Text token="displayLg" style={{ marginBottom: space[4] }}>
        Cat
      </Text>

      {/* Cat profile card */}
      <Pressable
        onPress={() => router.push({ pathname: '/cat-profile', params: cat ? { id: cat.id } : {} })}
        style={({ pressed }) => [
          styles.profileCard,
          {
            backgroundColor: t.surfaceElevated,
            borderColor: t.borderSubtle,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {cat?.photo_uri ? (
          <Image source={{ uri: cat.photo_uri }} style={styles.profilePhoto} />
        ) : (
          <View
            style={[
              styles.profilePhotoPlaceholder,
              { backgroundColor: t.primary100, borderColor: t.borderSubtle },
            ]}
          >
            <CatIcon size={36} color={t.primary700} weight="duotone" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text token="heading2" style={{ marginBottom: 2 }}>
            {cat?.name ?? 'Add your cat'}
          </Text>
          <Text token="caption" color="textMuted">
            {cat?.breed ?? 'No breed set'}
            {(() => {
              const yrs = resolveCatAgeYears(cat);
              return yrs != null ? ` · ${yrs} yrs` : '';
            })()}
            {cat?.weight_kg != null ? ` · ${cat.weight_kg} kg` : ''}
          </Text>
          <Text token="caption" style={{ color: t.primary700, marginTop: 6 }}>
            Edit profile →
          </Text>
        </View>
      </Pressable>

      {/* Multi-cat switcher */}
      {hasMultipleCats ? (
        <Row
          icon={<Users size={22} color={t.primary700} weight="duotone" />}
          title="Switch cat"
          body={`${cats.length} cats in your household`}
          onPress={() => router.push('/cats')}
        />
      ) : (
        <Row
          icon={<Users size={22} color={t.primary700} weight="duotone" />}
          title="Add another cat"
          body="Multi-cat household? Add a second profile."
          onPress={() => router.push('/cats')}
        />
      )}

      {/* Subscription */}
      <Row
        icon={<Crown size={22} color={t.primary700} weight="duotone" />}
        title="Subscription"
        body="Manage your CatMD plan"
        onPress={() => router.push('/paywall')}
      />

      {/* Settings */}
      <Row
        icon={<Gear size={22} color={t.primary700} weight="duotone" />}
        title="Settings"
        body="Notifications, account, data"
        onPress={() => router.push('/settings')}
      />

      <View style={{ marginTop: space[4] }}>
        <Text token="caption" color="textMuted" style={{ marginBottom: space[3], textTransform: 'uppercase', letterSpacing: 1 }}>
          Coming soon
        </Text>
        <ComingSoonRow
          icon={<Share size={22} color={t.textMuted} weight="duotone" />}
          title="Family + vet sharing"
          body="Let your partner, vet, or sitter see what's happening."
        />
        <ComingSoonRow
          icon={<House size={22} color={t.textMuted} weight="duotone" />}
          title="Pet sitter mode"
          body="One link → sitter sees feeding, meds, emergency vet — and nothing else."
        />
      </View>
    </ScrollView>
  );
}

type RowProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress: () => void;
};

function Row({ icon, title, body, onPress }: RowProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: t.surfaceElevated,
          borderColor: t.borderSubtle,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.primary100, borderColor: t.borderSubtle }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text token="heading3" style={{ marginBottom: 2 }}>
          {title}
        </Text>
        <Text token="caption" color="textMuted">
          {body}
        </Text>
      </View>
      <CaretRight size={20} color={t.textMuted} />
    </Pressable>
  );
}

function ComingSoonRow({ icon, title, body }: Omit<RowProps, 'onPress'>) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: t.surface,
          borderColor: t.borderSubtle,
          borderStyle: 'dashed',
          opacity: 0.85,
          marginBottom: space[2],
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Text token="heading3">{title}</Text>
          <View style={[styles.badge, { backgroundColor: t.surfaceSunken }]}>
            <Text token="caption" style={{ color: t.textMuted, fontSize: 10 }}>
              SOON
            </Text>
          </View>
        </View>
        <Text token="caption" color="textMuted">
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
  },
  profilePhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
});
