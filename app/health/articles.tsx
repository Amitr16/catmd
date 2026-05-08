/**
 * Article library — browse + search the 527 Knowledge Cards that power
 * CatMD triage. Every article is paraphrased from vetted sources
 * (merck veterinary manual, AAFP, ASPCA, peer-reviewed journals) with
 * full citations on the detail screen.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Books, CaretRight, MagnifyingGlass, WarningCircle } from 'phosphor-react-native';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import {
  ARTICLE_CATEGORIES,
  listArticles,
  searchArticles,
  type ArticleSummary,
} from '../../src/services/articles';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function ArticleLibrary() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounce the search input so we don't fire a Supabase query on every
  // keystroke. 250ms is snappy enough to feel instant but cheap enough
  // that a fast typer doesn't trigger a dozen round-trips.
  const debouncedQuery = useDebounced(query, 250);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = debouncedQuery.trim()
      ? searchArticles(debouncedQuery, { limit: 60 })
      : listArticles({ category: category === 'all' ? null : category, limit: 120 });
    void run.then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, category]);

  const grouped = useMemo(() => groupByCategory(items), [items]);

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
          <Books size={22} color={t.primary700} />
          <Text token="heading1" style={{ flex: 1 }}>Library</Text>
        </View>
        <Text token="body" color="textSecondary" style={{ marginTop: space[1] }}>
          Every article CatMD uses to reason about your cat. Paraphrased from
          vetted sources — full citations on each page.
        </Text>

        {/* Search */}
        <View
          style={{
            marginTop: space[4],
            height: 44,
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: t.borderStrong,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
          }}
        >
          <MagnifyingGlass size={18} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search topic — hyperthyroid, FIV, lily, FGS…"
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space[2], paddingVertical: space[3] }}
        >
          {ARTICLE_CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
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
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: space[6], alignItems: 'center' }}>
            <ActivityIndicator color={t.primary700} />
          </View>
        ) : items.length === 0 ? (
          <Card>
            <Text token="body" color="textSecondary">
              {query.trim()
                ? `No articles matched "${query}". Try a broader term.`
                : 'No articles loaded yet. Pull to refresh.'}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: space[4] }}>
            {grouped.map((g) => (
              <View key={g.category}>
                <Text
                  token="caption"
                  color="textMuted"
                  style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
                >
                  {g.label} · {g.items.length}
                </Text>
                <Card padded={false}>
                  {g.items.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 ? (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: t.borderSubtle,
                            marginHorizontal: space[4],
                          }}
                        />
                      ) : null}
                      <Pressable
                        onPress={() => router.push({ pathname: '/health/article', params: { id: a.id } })}
                        style={({ pressed }) => [
                          styles.row,
                          pressed ? { backgroundColor: t.surfaceSunken } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Open article: ${a.topic}`}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                            <Text
                              token="body"
                              style={{ fontFamily: 'Figtree_600SemiBold', flex: 1 }}
                              numberOfLines={2}
                            >
                              {a.topic}
                            </Text>
                            {a.emergency_tags.length > 0 ? (
                              <WarningCircle size={14} color={t.error} weight="fill" />
                            ) : null}
                          </View>
                          <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
                            {a.source_count} source{a.source_count === 1 ? '' : 's'}
                            {a.is_llm_fallback ? ' · LLM-authored' : ''}
                          </Text>
                        </View>
                        <CaretRight size={16} color={t.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return v;
}

function groupByCategory(items: ArticleSummary[]): {
  category: string; label: string; items: ArticleSummary[];
}[] {
  const labelMap = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.key, c.label]));
  const map = new Map<string, ArticleSummary[]>();
  for (const a of items) {
    const arr = map.get(a.category) ?? [];
    arr.push(a);
    map.set(a.category, arr);
  }
  return Array.from(map.entries())
    .map(([category, arr]) => ({
      category,
      label: labelMap[category] ?? category,
      items: arr,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
});
