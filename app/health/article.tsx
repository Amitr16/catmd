/**
 * Article detail — renders a single Knowledge Card.
 *
 * Layout:
 *   - Header: topic + category chip + emergency tags
 *   - Cat-specific notes (the "why this matters for cats" preamble)
 *   - Symptoms
 *   - Emergency threshold + time-to-vet rows
 *   - Differentials (cross-link to related cards when topic matches)
 *   - Toxicology block if present
 *   - Related topics
 *   - Sources (clickable URLs, except internal:// LLM-authored)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info, LinkSimple, WarningCircle } from 'phosphor-react-native';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { getArticleById } from '../../src/services/articles';
import { isLlmFallbackCard, type KnowledgeCardRow } from '../../src/services/supabase';
import { useTheme } from '../../src/theme/useTheme';
import { radius, space } from '../../src/theme/tokens';

export default function ArticleDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [article, setArticle] = useState<KnowledgeCardRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!id) { setLoading(false); return; }
    void getArticleById(id).then((a) => {
      if (cancelled) return;
      setArticle(a);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  const fallbackOnly = useMemo(
    () => (article ? isLlmFallbackCard(article) : false),
    [article],
  );

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + space[10] }]}>
        <ActivityIndicator color={t.primary700} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + space[10] }]}>
        <Text token="heading2">Article not found</Text>
        <Text token="body" color="textSecondary" style={{ marginTop: space[2], textAlign: 'center' }}>
          It may have been removed. Return to the library to browse other topics.
        </Text>
      </View>
    );
  }

  const b = article.body;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[10] },
      ]}
    >
      <Text token="heading1">{article.topic}</Text>
      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2], alignItems: 'center', flexWrap: 'wrap' }}>
        <CategoryChip label={article.category} />
        {article.emergency_tags.map((tag) => (
          <EmergencyChip key={tag} label={tag} />
        ))}
        {fallbackOnly ? <CategoryChip label="LLM-authored" subtle /> : null}
      </View>

      {b.cat_specific_notes ? (
        <Card style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[1] }}>
            <Info size={16} color={t.primary700} />
            <Text token="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Why this matters for cats
            </Text>
          </View>
          <Text token="body">{b.cat_specific_notes}</Text>
        </Card>
      ) : null}

      {b.symptoms?.length > 0 ? (
        <Section title="Symptoms">
          {b.symptoms.map((s, i) => (
            <Text key={i} token="body" style={{ marginTop: i === 0 ? 0 : space[1] }}>
              · {s}
            </Text>
          ))}
        </Section>
      ) : null}

      {(b.emergency_threshold || anyTimeToVet(b.time_to_vet)) ? (
        <Section title="When to act">
          {b.emergency_threshold ? (
            <KV label="Emergency threshold" value={b.emergency_threshold} />
          ) : null}
          {b.time_to_vet.urgent ? <KV label="Urgent" value={b.time_to_vet.urgent} /> : null}
          {b.time_to_vet.concern ? <KV label="Concern" value={b.time_to_vet.concern} /> : null}
          {b.time_to_vet.monitor ? <KV label="Monitor" value={b.time_to_vet.monitor} /> : null}
          {b.time_to_vet.routine ? <KV label="Routine" value={b.time_to_vet.routine} /> : null}
        </Section>
      ) : null}

      {b.differentials?.length > 0 ? (
        <Section title="Differential diagnoses">
          {b.differentials.map((d, i) => (
            <Text key={i} token="body" style={{ marginTop: i === 0 ? 0 : space[1] }}>
              · {d}
            </Text>
          ))}
        </Section>
      ) : null}

      {b.toxicology ? (
        <Section title={`Toxicology: ${b.toxicology.substance}`}>
          {b.toxicology.minimum_toxic_dose_mg_per_kg != null ? (
            <KV label="Minimum toxic dose" value={`${b.toxicology.minimum_toxic_dose_mg_per_kg} mg/kg`} />
          ) : null}
          {b.toxicology.ld50_mg_per_kg != null ? (
            <KV label="LD50" value={`${b.toxicology.ld50_mg_per_kg} mg/kg`} />
          ) : null}
          {b.toxicology.onset_hours != null ? (
            <KV label="Onset" value={`${b.toxicology.onset_hours}h`} />
          ) : null}
          {b.toxicology.mechanism ? (
            <Text token="body" style={{ marginTop: space[2] }}>{b.toxicology.mechanism}</Text>
          ) : null}
        </Section>
      ) : null}

      {b.breed_risks?.length > 0 ? (
        <Section title="Breed risks">
          <Text token="body">{b.breed_risks.join(', ')}</Text>
        </Section>
      ) : null}

      {b.age_risks ? (
        <Section title="Age risks">
          <Text token="body">{b.age_risks}</Text>
        </Section>
      ) : null}

      {b.aliases?.length > 0 ? (
        <Section title="Also known as">
          <Text token="body" color="textSecondary">{b.aliases.join(', ')}</Text>
        </Section>
      ) : null}

      {b.related_topics?.length > 0 ? (
        <Section title="Related">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {b.related_topics.map((rt, i) => (
              <View key={i} style={{
                paddingHorizontal: space[3],
                paddingVertical: space[1],
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: t.borderStrong,
              }}>
                <Text token="caption" color="textPrimary">{rt}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Sources */}
      <Section title="Sources">
        {article.sources.length === 0 ? (
          <Text token="body" color="textMuted">No source URLs attached.</Text>
        ) : (
          article.sources.map((s, i) => {
            const internal = s.url.startsWith('internal://');
            return (
              <Pressable
                key={i}
                onPress={() => {
                  if (!internal) Linking.openURL(s.url).catch(() => {});
                }}
                disabled={internal}
                style={{ paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] }}
                accessibilityRole={internal ? undefined : 'link'}
              >
                <LinkSimple size={14} color={internal ? t.textMuted : t.primary700} />
                <View style={{ flex: 1 }}>
                  <Text token="body" color={internal ? 'textMuted' : 'primary700'} numberOfLines={2}>
                    {s.title || s.url}
                  </Text>
                  {!internal ? (
                    <Text token="caption" color="textMuted" numberOfLines={1}>{s.url}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </Section>

      <Text
        token="caption"
        color="textMuted"
        style={{ textAlign: 'center', marginTop: space[6] }}
      >
        CatMD library · confidence {(article.confidence * 100).toFixed(0)}% ·
        Informational only, not veterinary advice.
      </Text>
    </ScrollView>
  );
}

function anyTimeToVet(ttv: KnowledgeCardRow['body']['time_to_vet']): boolean {
  return !!(ttv.urgent || ttv.concern || ttv.monitor || ttv.routine);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space[5] }}>
      <Text
        token="caption"
        color="textMuted"
        style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: space[2] }}
      >
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space[3],
        paddingVertical: space[2],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.borderSubtle,
      }}
    >
      <Text token="caption" color="textMuted" style={{ flex: 1 }}>{label}</Text>
      <Text token="body" style={{ flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function CategoryChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: subtle ? t.surfaceSunken : t.primary50,
        borderWidth: 1,
        borderColor: subtle ? t.borderSubtle : t.primary300,
      }}
    >
      <Text
        token="caption"
        style={{
          color: subtle ? t.textMuted : t.primary700,
          fontFamily: 'Figtree_600SemiBold',
          textTransform: 'capitalize',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function EmergencyChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: t.error,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <WarningCircle size={12} color={t.textInverse} weight="fill" />
      <Text token="caption" style={{ color: t.textInverse, fontFamily: 'Figtree_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space[5] },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: space[5],
  },
});
