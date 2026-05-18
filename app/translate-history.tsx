/**
 * Translate history — past meow translations the cat has accumulated.
 *
 * ── Why this screen exists ─────────────────────────────────────────
 * Every /translate run writes a `meow_translation` event to
 * healthStore. Those translations feed:
 *   - cat-says greatest hits scroll (mixed with chat replies)
 *   - catContext.recentMeowSignals → chat / diary tone consistency
 *   - cloud backup via cat_events
 *
 * Without this screen, translations were write-only from the user's
 * perspective — they'd see the result once, then it disappeared into
 * the system. This screen is the chronological log: every line your
 * cat has "said", with the share button right there.
 *
 * Mirrors app/behavior-history.tsx — same row-card pattern, same
 * intro card, same delete affordance, same record-new-CTA at bottom.
 *
 * ── What's different from behavior-history ─────────────────────────
 *   - No notes affordance (translations are short by design; the
 *     line IS the artifact, no annotation needed)
 *   - Hero on the row is the CAT-VOICE LINE in italic serif, not a
 *     "Most likely:" headline (translation IS the headline)
 *   - Each row gets a Share button so re-sharing past lines is one
 *     tap (matches the cat-says pattern but per-row)
 *   - Tags are vocalization_type + intent + confidence (3 pills)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CaretDown,
  CaretRight,
  Microphone,
  Plus,
  ShareNetwork,
  Sparkle,
  Trash,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/Button';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useHealthStore, type HealthEvent } from '../src/state/healthStore';
import { track } from '../src/services/analytics';

type Translation = HealthEvent<'meow_translation'>;

// ─── Helpers ───────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const obsDay = new Date(iso);
  const obsDayStart = new Date(
    obsDay.getFullYear(),
    obsDay.getMonth(),
    obsDay.getDate(),
  ).getTime();
  const daysAgo = Math.round((today - obsDayStart) / dayMs);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 30) return `${daysAgo} days ago`;
  return iso.slice(0, 10);
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// ─── Screen ────────────────────────────────────────────────────────

export default function TranslateHistoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();

  const events = useHealthStore((s) => s.events);
  const translations = useMemo<Translation[]>(() => {
    if (!cat?.id) return [];
    return events
      .filter(
        (e): e is Translation =>
          e.cat_id === cat.id && e.type === 'meow_translation',
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [events, cat?.id]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} title="Translations" />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">
            Add a cat first — Settings → Manage cats.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header
        onBack={() => router.back()}
        title={`${cat.name} said`}
        subtitle={
          translations.length > 0
            ? `${translations.length} ${translations.length === 1 ? 'translation' : 'translations'} on file`
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
          paddingTop: space[3],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro card — explains how translations feed the rest of the
            app. Same shape as behavior-history's "How {cat} uses these"
            so the two screens read as a pair. */}
        <View style={[styles.introCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
          <View style={styles.introHeader}>
            <Sparkle size={18} color={t.primary500} weight="duotone" />
            <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
              How {cat.name} uses these
            </Text>
          </View>
          <Text token="caption" color="textSecondary" style={{ marginTop: space[2], lineHeight: 18 }}>
            Every translation is saved here. {cat.name}&apos;s recent voice
            shapes how chat + diary read the room (so {cat.name} stays
            consistent — not chirpy one minute and grumpy the next).
            Tap any line to expand and re-share.
          </Text>
        </View>

        {/* Empty state */}
        {translations.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
            <Microphone size={28} color={t.textMuted} weight="duotone" />
            <Text token="body" color="textSecondary" style={{ textAlign: 'center', marginTop: space[3] }}>
              No translations yet.
            </Text>
            <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[1] }}>
              Record 4 seconds of {cat.name} — voice + posture + memory
              fuse into a screenshottable line in {cat.name}&apos;s voice.
            </Text>
            <View style={{ marginTop: space[4] }}>
              <Button
                label="Translate now"
                onPress={() => router.replace('/translate' as never)}
              />
            </View>
          </View>
        ) : null}

        {/* List */}
        {translations.map((tx) => (
          <TranslationRow
            key={tx.id}
            tx={tx}
            catName={cat.name}
            isExpanded={expandedId === tx.id}
            onToggle={() =>
              setExpandedId((cur) => (cur === tx.id ? null : tx.id))
            }
          />
        ))}

        {/* Bottom CTA */}
        {translations.length > 0 ? (
          <Pressable
            onPress={() => router.replace('/translate' as never)}
            style={[styles.recordCta, { borderColor: t.primary500 }]}
          >
            <Plus size={18} color={t.primary500} weight="bold" />
            <Text token="body" style={{ color: t.primary500, marginLeft: space[2], fontWeight: '600' }}>
              Translate another
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Header({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void;
  title: string;
  subtitle?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: t.borderSubtle }]}>
      <Pressable onPress={onBack} style={styles.headerBack} hitSlop={12}>
        <ArrowLeft size={24} color={t.textPrimary} weight="bold" />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text token="heading3" style={{ color: t.textPrimary }}>
          {title}
        </Text>
        {subtitle ? (
          <Text token="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function TranslationRow({
  tx,
  catName,
  isExpanded,
  onToggle,
}: {
  tx: Translation;
  catName: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const p = tx.payload;
  const intentLabel = p.intent.replace(/_/g, ' ');
  const confidenceLabel =
    p.confidence === 'high' ? 'high' : p.confidence === 'moderate' ? 'moderate' : 'low';

  const onShare = async () => {
    const text = `${catName} says:\n\n"${p.translation}"\n\n— translated by CatMD`;
    try {
      await Share.share({ message: text });
      track({
        type: 'translation_shared',
        props: { intent: p.intent, confidence: p.confidence },
      });
    } catch (e) {
      console.warn('[TranslateHistory] share failed:', e);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete this translation?',
      `It'll be removed from ${catName}'s memory and won't shape future readings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEvent(tx.id),
        },
      ],
    );
  };

  return (
    <View style={[styles.rowCard, { backgroundColor: t.surface, borderColor: t.borderSubtle }]}>
      {/* Tappable header — date + the cat-voice line as the hero. */}
      <Pressable onPress={onToggle} style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.dateRow}>
            <Text token="caption" style={{ color: t.textPrimary, fontWeight: '600' }}>
              {relativeDate(tx.ts)}
            </Text>
            <Text token="caption" color="textMuted" style={{ marginLeft: space[2] }}>
              · {timeOfDay(tx.ts)}
            </Text>
          </View>

          {/* THE LINE — italic serif, same treatment as cat-says scroll
              so the visual language is consistent across surfaces. */}
          <Text
            style={{
              color: t.textPrimary,
              fontFamily: 'SourceSerif4_500Medium',
              fontStyle: 'italic',
              fontSize: 17,
              lineHeight: 26,
              marginTop: space[1],
            }}
            numberOfLines={isExpanded ? undefined : 3}
          >
            “{p.translation}”
          </Text>

          {/* Compact tag row when collapsed: vocalization · intent. */}
          {!isExpanded ? (
            <View style={styles.tagPeek}>
              <View style={[styles.tagPill, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
                <Text token="caption" style={{ color: t.textSecondary, fontSize: 11 }}>
                  {p.vocalization_type}
                </Text>
              </View>
              <View style={[styles.tagPill, { borderColor: t.secondary300, backgroundColor: t.secondary100 }]}>
                <Text token="caption" style={{ color: t.secondary900, fontSize: 11 }}>
                  {intentLabel}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
        <View style={{ marginLeft: space[2], alignSelf: 'center' }}>
          {isExpanded ? (
            <CaretDown size={18} color={t.textMuted} weight="bold" />
          ) : (
            <CaretRight size={18} color={t.textMuted} weight="bold" />
          )}
        </View>
      </Pressable>

      {/* Expanded body */}
      {isExpanded ? (
        <View style={styles.rowExpanded}>
          {/* Full tag row */}
          <View style={styles.tagRowFull}>
            <View style={[styles.tagPill, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
              <Text token="caption" style={{ color: t.textSecondary }}>
                {p.vocalization_type}
              </Text>
            </View>
            <View style={[styles.tagPill, { borderColor: t.secondary300, backgroundColor: t.secondary100 }]}>
              <Text token="caption" style={{ color: t.secondary900, fontWeight: '600' }}>
                {intentLabel}
              </Text>
            </View>
            <View style={[styles.tagPill, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}>
              <Text token="caption" style={{ color: t.textSecondary }}>
                {confidenceLabel} confidence
              </Text>
            </View>
          </View>

          {/* Why card — small caption with reasoning, mirrors the
              live result screen's "Why we read it that way" block. */}
          <View style={[styles.whyCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
            <Text token="caption" style={{ color: t.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Why we read it that way
            </Text>
            <Text token="caption" style={{ color: t.textSecondary, lineHeight: 18 }}>
              {p.why}
            </Text>
            {p.had_audio && p.audio_transcript ? (
              <Text token="caption" style={{ color: t.textMuted, marginTop: 6 }}>
                We heard: &ldquo;{p.audio_transcript}&rdquo;
              </Text>
            ) : (
              <Text token="caption" style={{ color: t.textMuted, marginTop: 6 }}>
                Body language only — no audio captured.
              </Text>
            )}
          </View>

          {/* Per-row Share — re-sharing an old line in one tap is
              the whole point of this screen. */}
          <View style={{ marginTop: space[3] }}>
            <Button
              label="Share this line"
              size="sm"
              fullWidth
              leftIcon={<ShareNetwork size={16} color={t.textInverse} weight="bold" />}
              onPress={onShare}
            />
          </View>

          {/* Footer — delete sits behind expand so it's deliberate. */}
          <View style={[styles.expandedFooter, { borderTopColor: t.borderSubtle }]}>
            <Pressable onPress={onDelete} style={styles.deleteAction} hitSlop={8}>
              <Trash size={14} color={t.error} weight="bold" />
              <Text token="caption" style={{ marginLeft: space[1], color: t.error, fontWeight: '600' }}>
                Delete translation
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
  },
  headerBack: { padding: space[2] },
  headerSpacer: { width: 40 },
  introCard: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    padding: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[4],
    alignItems: 'center',
  },
  rowCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[3],
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    alignItems: 'flex-start',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagPeek: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: space[2],
    gap: space[1] + 2,
  },
  rowExpanded: {
    paddingHorizontal: space[4],
    paddingBottom: space[4],
  },
  tagRowFull: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1] + 2,
    marginTop: space[3],
  },
  tagPill: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  whyCard: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  expandedFooter: {
    marginTop: space[4],
    paddingTop: space[3],
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  recordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: space[5],
  },
});
