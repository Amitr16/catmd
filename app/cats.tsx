/**
 * Cat list — switch active, add new, edit existing.
 *
 * Free users: max 1 cat (adding cat #2 routes to paywall).
 * Pro users: unlimited.
 *
 * The "active" cat controls what the dashboard, scan flow, and result
 * screen are scoped to — so switching cats feels like switching contexts.
 */
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CaretRight,
  Cat as CatIcon,
  CheckCircle,
  Crown,
  Plus,
  Trash,
} from 'phosphor-react-native';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import { useCatStore, newCat, type CatProfile } from '../src/state/catStore';
import { useNotificationStore } from '../src/state/notificationStore';
import { useCatQuota } from '../src/hooks/useCatQuota';
import { useTheme } from '../src/theme/useTheme';
import { radius, space } from '../src/theme/tokens';

export default function CatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const cats = useCatStore((s) => s.cats);
  const activeCatId = useCatStore((s) => s.activeCatId);
  const addCat = useCatStore((s) => s.addCat);
  const setActiveCat = useCatStore((s) => s.setActiveCat);
  const deleteCat = useCatStore((s) => s.deleteCat);
  const clearReminders = useNotificationStore((s) => s.clearForCat);
  const quota = useCatQuota();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const onAdd = () => {
    if (!quota.canAddCat) {
      router.push({ pathname: '/paywall', params: { source: 'cats' } });
      return;
    }
    setAdding(true);
  };

  const confirmAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const c = newCat(name);
    addCat(c);
    setActiveCat(c.id);
    setNewName('');
    setAdding(false);
    router.push('/cat-profile');
  };

  const onDelete = (c: CatProfile) => {
    if (cats.length === 1) {
      Alert.alert(
        'Keep at least one cat',
        'CatMD needs an active cat to work. Add another before removing this one.',
      );
      return;
    }
    Alert.alert(
      `Remove ${c.name}?`,
      'All scans and history for this cat will be deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearReminders(c.id);
            deleteCat(c.id);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + space[4],
          paddingBottom: insets.bottom + space[8],
        },
      ]}
    >
      <Text token="heading1">Your cats</Text>
      <Text token="bodyLg" color="textSecondary" style={{ marginTop: space[1] }}>
        {quota.isPro
          ? 'Add as many cats as you like. Tap one to switch context.'
          : `Free tier: ${quota.used}/${quota.limit} cat. Upgrade to Pro for unlimited households.`}
      </Text>

      <View style={{ marginTop: space[6], gap: space[2] }}>
        {cats.map((c) => {
          const isActive = c.id === activeCatId;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                setActiveCat(c.id);
                router.push('/cat-profile');
              }}
              style={({ pressed }) => [
                { borderRadius: radius.lg },
                pressed ? { opacity: 0.9, transform: [{ scale: 0.995 }] } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}${isActive ? ', currently active' : ''}. Tap to open profile.`}
            >
              <Card>
                <View style={styles.row}>
                  <Avatar uri={c.photo_uri} fallback={c.name[0]?.toUpperCase() ?? 'C'} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Text token="heading3" numberOfLines={1}>
                        {c.name}
                      </Text>
                      {isActive ? (
                        <View
                          style={{
                            paddingHorizontal: space[2],
                            paddingVertical: 2,
                            borderRadius: radius.full,
                            backgroundColor: t.primary100,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle size={12} color={t.primary700} weight="fill" />
                          <Text token="caption" style={{ color: t.primary700 }}>
                            Active
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text token="caption" color="textMuted" numberOfLines={1}>
                      {[c.breed, ageLabel(c), c.weight_kg ? `${c.weight_kg} kg` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Tap to complete profile'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onDelete(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${c.name}`}
                    hitSlop={8}
                    style={{ padding: space[1] }}
                  >
                    <Trash size={18} color={t.textMuted} />
                  </Pressable>
                  <CaretRight size={16} color={t.textMuted} />
                </View>
              </Card>
            </Pressable>
          );
        })}

        {adding ? (
          <Card>
            <Text token="caption" color="textMuted" style={{ marginBottom: space[1] }}>
              Cat's name
            </Text>
            <TextInput
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Luna"
              placeholderTextColor={t.textMuted}
              returnKeyType="done"
              onSubmitEditing={confirmAdd}
              style={{
                height: 48,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                color: t.textPrimary,
                fontFamily: 'Figtree_500Medium',
                fontSize: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setAdding(false);
                  setNewName('');
                }}
              />
              <Button
                label="Create"
                onPress={confirmAdd}
                disabled={!newName.trim()}
              />
            </View>
          </Card>
        ) : (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addRow,
              {
                borderColor: t.borderStrong,
                backgroundColor: pressed ? t.surfaceSunken : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add another cat"
          >
            {quota.canAddCat ? (
              <>
                <Plus size={18} color={t.primary700} />
                <Text token="body" style={{ color: t.primary700, fontFamily: 'Figtree_500Medium' }}>
                  Add another cat
                </Text>
              </>
            ) : (
              <>
                <Crown size={18} color={t.warning} weight="fill" />
                <Text token="body" style={{ color: t.textPrimary, fontFamily: 'Figtree_500Medium' }}>
                  Upgrade to Pro to add more cats
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function ageLabel(c: CatProfile): string | null {
  if (c.age_months != null && c.age_months > 0) {
    const y = c.age_months / 12;
    if (y < 1) return `${c.age_months} mo`;
    if (y < 2) return `${y.toFixed(1)} yr`;
    return `${Math.round(y)} yr`;
  }
  return null;
}

function Avatar({ uri, fallback }: { uri: string | null; fallback: string }) {
  const t = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: t.borderSubtle,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: t.borderSubtle,
        backgroundColor: t.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon size={22} color={t.primary700} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  addRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
