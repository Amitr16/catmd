/**
 * Becoming — "your cat is taking shape inside this app" screen.
 *
 * The narrative: each contribution (photo, chat turn, body-language
 * session, daily check-in, named subject, personality answer, diary
 * day) sharpens the cat-in-the-app's identity. This screen surfaces
 * the seven facets, their stages, and what the user can do next to
 * deepen each one.
 *
 * Tone: aristocratic-melancholic, restrained. Never gamified
 * ("checklist!"), never thirsty ("level up!"). The cat is observing
 * its own becoming.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CaretRight,
  Camera as CameraIcon,
  ChatCircle,
  Clock,
  Heart,
  MaskHappy,
  NotePencil,
  PawPrint,
  PencilSimple,
  PlayCircle,
  Plus,
  Trash,
  UsersThree,
  X,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useCatStore } from '../src/state/catStore';
import { useHealthStore } from '../src/state/healthStore';
import { useChatStore } from '../src/state/chatStore';
import { usePhotosForCat } from '../src/state/photoStudioStore';
import { useSubjectsForCat } from '../src/state/subjectDirectoryStore';
import { useDiaryEntriesForCat } from '../src/state/diaryStore';
import { usePersonalityQuizAnswered } from '../src/state/personalityStore';
import {
  deriveBecoming,
  snapshotStages,
  type Becoming,
  type Facet,
  type FacetId,
} from '../src/services/becoming';
import { useBecomingStore, milestoneKey } from '../src/state/becomingStore';
import {
  useSelfFactsForCat,
  useSelfFactsStore,
  type SelfFact,
  type SelfFactCategory,
} from '../src/state/selfFactsStore';
import { track } from '../src/services/analytics';

export default function BecomingScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();
  const becoming = useBecoming(cat?.id ?? null);

  // Telemetry — surface how often this screen gets opened.
  useEffect(() => {
    if (!cat?.id || !becoming) return;
    track({
      type: 'becoming_opened',
      props: {
        depth: becoming.depth,
        overall_stage: becoming.overallStage,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  // Persist the stage snapshot — but ONLY when it actually changed.
  // Earlier version called setLastStages on every render, which
  // triggered an infinite re-render loop: the store update caused
  // useBecoming to recompute, new `becoming` reference fired the
  // effect again, store updated, etc. This crashed the screen with
  // "Maximum update depth exceeded".
  //
  // We now compare the new snapshot to the stored one (deep equality
  // via JSON.stringify) and skip the persist if they match.
  useEffect(() => {
    if (!cat?.id || !becoming) return;
    const store = useBecomingStore.getState();
    const newSnapshot = snapshotStages(becoming);
    const existingSnapshot = store.getLastStages(cat.id) ?? {};
    // Cheap deep-equal: JSON.stringify on a tiny stage map (≤7 keys).
    if (JSON.stringify(newSnapshot) !== JSON.stringify(existingSnapshot)) {
      store.setLastStages(cat.id, newSnapshot);
    }
    if (becoming.milestoneToday) {
      const key = milestoneKey(
        becoming.milestoneToday.facet,
        becoming.milestoneToday.stage,
      );
      if (!store.hasConsumedMilestone(cat.id, key)) {
        store.markMilestoneConsumed(cat.id, key);
        track({
          type: 'becoming_milestone_hit',
          props: {
            facet: becoming.milestoneToday.facet,
            stage: becoming.milestoneToday.stage,
            value: becoming.milestoneToday.value,
          },
        });
      }
    }
  }, [cat?.id, becoming]);

  if (!cat || !becoming) {
    return (
      <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={{ padding: space[6] }}>
          <Text token="body" color="textMuted">
            Add a cat first — Settings → Manage cats.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.surface, paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[8],
        }}
      >
        {/* Header — sets the frame. */}
        <View style={{ marginBottom: space[5] }}>
          <Text token="caption" color="textMuted" style={styles.eyebrow}>
            Becoming
          </Text>
          <Text token="heading1" style={{ marginTop: 4 }}>
            {cat.name} is becoming themselves.
          </Text>
          <Text
            token="body"
            color="textMuted"
            style={{ marginTop: space[2], lineHeight: 22 }}
          >
            Every photo, voice, video, name, and check-in sharpens the {cat.name} that lives in here.
            The diary, the postcards, the posters — they all grow more like {cat.name} the more you give them.
          </Text>
        </View>

        {/* Composite depth card */}
        <DepthCard becoming={becoming} catName={cat.name} />

        {/* Facet cards */}
        <View style={{ marginTop: space[5], gap: space[3] }}>
          {becoming.facets.map((f) => (
            <FacetCard
              key={f.id}
              facet={f}
              onPress={() => {
                track({
                  type: 'becoming_facet_cta_tapped',
                  props: { facet: f.id, stage: f.stage },
                });
                router.push(f.ctaRoute as never);
              }}
            />
          ))}
        </View>

        {/* Self-facts — things the cat knows about itself, learned
            from chat and entered manually. These are the most personal
            slice of the cat's identity inside the app. */}
        <SelfFactsSection catId={cat.id} catName={cat.name} />

        {/* Closing note */}
        <View
          style={[
            styles.closingNote,
            { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
          ]}
        >
          <Text token="caption" color="textMuted" style={{ lineHeight: 17 }}>
            None of this leaves your phone. Photos, names, the diary, and these self-facts all stay local. Sync to the cloud is opt-in (Pro).
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composite depth card
// ---------------------------------------------------------------------------

function DepthCard({ becoming, catName }: { becoming: Becoming; catName: string }) {
  const t = useTheme();

  return (
    <View
      style={[
        styles.depthCard,
        {
          backgroundColor: t.secondary50,
          borderColor: t.secondary500,
        },
      ]}
    >
      <Text token="caption" color="textMuted" style={styles.eyebrow}>
        Right now, {catName} is
      </Text>
      <Text
        token="heading1"
        style={{ marginTop: 4, color: t.secondary900, fontStyle: 'italic' }}
      >
        {becoming.overallStage}.
      </Text>
      <View style={{ marginTop: space[3] }}>
        <View
          style={[
            styles.depthTrack,
            { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
          ]}
        >
          <View
            style={[
              styles.depthFill,
              {
                width: `${Math.max(2, becoming.depth)}%`,
                backgroundColor: t.secondary500,
              },
            ]}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Text token="caption" color="textMuted">
            depth
          </Text>
          <Text token="caption" style={{ color: t.secondary900, fontFamily: 'JetBrainsMono_500Medium' }}>
            {becoming.depth} / 100
          </Text>
        </View>
      </View>
      {becoming.milestoneToday ? (
        <View
          style={[
            styles.milestoneCallout,
            { backgroundColor: t.surfaceElevated, borderColor: t.secondary500 },
          ]}
        >
          <Text
            token="caption"
            color="textMuted"
            style={{
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            New milestone today
          </Text>
          <Text
            token="body"
            style={{ color: t.secondary900, fontStyle: 'italic', lineHeight: 21 }}
          >
            “{becoming.milestoneToday.diaryHook}”
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Facet card
// ---------------------------------------------------------------------------

function FacetCard({
  facet,
  onPress,
}: {
  facet: Facet;
  onPress: () => void;
}) {
  const t = useTheme();
  const Icon = facetIcon(facet.id);
  const stageLabel = stageDisplay(facet.stage);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${facet.label} — ${stageLabel}. ${facet.ctaLabel}`}
      style={({ pressed }) => [
        styles.facetCard,
        {
          backgroundColor: t.surfaceElevated,
          borderColor: t.borderSubtle,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={[
            styles.facetBadge,
            { backgroundColor: t.secondary100, borderColor: t.borderSubtle },
          ]}
        >
          <Icon size={20} color={t.secondary700} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[2],
            }}
          >
            <Text token="heading3">{facet.label}</Text>
            <View
              style={[
                styles.stagePill,
                {
                  backgroundColor:
                    facet.stage === 'unseen'
                      ? t.surfaceSunken
                      : t.secondary100,
                  borderColor:
                    facet.stage === 'unseen'
                      ? t.borderSubtle
                      : t.secondary500,
                },
              ]}
            >
              <Text
                token="caption"
                style={{
                  color:
                    facet.stage === 'unseen' ? t.textMuted : t.secondary900,
                  fontFamily: 'Figtree_600SemiBold',
                  fontSize: 10,
                }}
              >
                {stageLabel}
              </Text>
            </View>
          </View>
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: 2, fontFamily: 'JetBrainsMono_400Regular', fontSize: 11 }}
          >
            {facet.eyebrow} · {facet.currentValue}
          </Text>
        </View>
      </View>

      <Text
        token="body"
        style={{
          marginTop: space[3],
          color: t.textSecondary,
          lineHeight: 21,
          fontStyle: 'italic',
        }}
      >
        {facet.description}
      </Text>

      {/* Stage progress bar */}
      {facet.nextMilestone ? (
        <View style={{ marginTop: space[3] }}>
          <View
            style={[
              styles.stageTrack,
              { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
            ]}
          >
            <View
              style={[
                styles.stageFill,
                {
                  width: `${Math.max(2, facet.stageProgress * 100)}%`,
                  backgroundColor: t.secondary500,
                },
              ]}
            />
          </View>
          <Text
            token="caption"
            color="textMuted"
            style={{ marginTop: 4, fontSize: 11 }}
          >
            Next: {facet.nextMilestone.label.toLowerCase()} at {facet.nextMilestone.value}
          </Text>
        </View>
      ) : null}

      {/* CTA */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space[3],
        }}
      >
        <Text
          token="caption"
          style={{
            color: t.secondary900,
            fontFamily: 'Figtree_600SemiBold',
          }}
        >
          {facet.ctaLabel}
        </Text>
        <CaretRight size={16} color={t.secondary700} />
      </View>
    </Pressable>
  );
}

function facetIcon(id: FacetId) {
  switch (id) {
    case 'face':
      return CameraIcon;
    case 'voice':
      return ChatCircle;
    case 'body':
      return PlayCircle;
    case 'rhythm':
      return Clock;
    case 'family':
      return UsersThree;
    case 'nature':
      return MaskHappy;
    case 'memory':
      return NotePencil;
  }
}

function stageDisplay(stage: Facet['stage']): string {
  switch (stage) {
    case 'unseen':
      return 'unseen';
    case 'glimpsed':
      return 'glimpsed';
    case 'familiar':
      return 'familiar';
    case 'known':
      return 'known';
    case 'deep':
      return 'deep';
  }
}

// ---------------------------------------------------------------------------
// Hook: deriveBecoming wired to live store state
// ---------------------------------------------------------------------------

function useBecoming(catId: string | null): Becoming | null {
  // All inputs subscribed live so the screen rerenders on any change.
  const photos = usePhotosForCat(catId);
  const allEvents = useHealthStore((s) => s.events);
  const events = useMemo(
    () => (catId ? allEvents.filter((e) => e.cat_id === catId) : []),
    [allEvents, catId],
  );
  const subjects = useSubjectsForCat(catId);
  const diaryEntries = useDiaryEntriesForCat(catId);
  const personalityAnswered = usePersonalityQuizAnswered(catId);
  const chatTurnCount = useChatStore((s) => (catId ? (s.threads[catId] ?? []).length : 0));
  const previousStages = useBecomingStore((s) => (catId ? s.lastStages[catId] ?? null : null));

  return useMemo(() => {
    if (!catId) return null;

    // Body language sessions = behavior_observation events for this cat.
    const bodyLanguageSessionCount = events.filter(
      (e) => e.type === 'behavior_observation',
    ).length;

    // Check-in streak — count consecutive days backwards from today
    // where a daily_checkin event exists. Uses local-day boundaries.
    const checkinStreak = countCheckinStreak(events);

    return deriveBecoming({
      photoCount: photos.length,
      chatTurnCount,
      bodyLanguageSessionCount,
      checkinStreak,
      namedSubjectsCount: subjects.length,
      personalityArchetypeSet: personalityAnswered,
      diaryEntryCount: diaryEntries.length,
      previousStages,
    });
  }, [
    catId,
    photos.length,
    chatTurnCount,
    events,
    subjects.length,
    personalityAnswered,
    diaryEntries.length,
    previousStages,
  ]);
}

/**
 * Local helper — count consecutive recent days with a daily_checkin
 * event. Self-contained so this screen doesn't need to import a
 * shared streak helper from healthStore. Streak resets on a missed
 * day; today's absence is tolerated until the user has a chance
 * to check in.
 */
function countCheckinStreak(events: { type: string; ts: string }[]): number {
  const checkinDates = new Set<string>();
  for (const e of events) {
    if (e.type !== 'daily_checkin') continue;
    try {
      const d = new Date(e.ts);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      checkinDates.add(k);
    } catch {
      // skip
    }
  }
  if (checkinDates.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  // Allow today to be missing (user hasn't checked in yet) by
  // starting the count from yesterday. If today is checked in,
  // the loop also catches it.
  let firstHit = false;
  for (let i = 0; i < 365; i += 1) {
    const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (checkinDates.has(k)) {
      firstHit = true;
      streak += 1;
    } else if (firstHit) {
      break;
    } else if (i > 0) {
      // No check-in today AND no check-in yesterday — streak is 0.
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space[3],
        paddingVertical: space[3],
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel="Back"
      >
        <ArrowLeft size={22} color={t.textPrimary} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <View style={{ width: 40 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Self-facts section
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: SelfFactCategory[] = [
  'food',
  'love',
  'fear',
  'habit',
  'place',
  'history',
  'preference',
  'other',
];

function SelfFactsSection({ catId, catName }: { catId: string; catName: string }) {
  const t = useTheme();
  const facts = useSelfFactsForCat(catId);
  const upsertFact = useSelfFactsStore((s) => s.upsertFact);
  const deleteFact = useSelfFactsStore((s) => s.deleteFact);

  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<SelfFactCategory>('love');
  const [showAdd, setShowAdd] = useState(false);

  const onAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      upsertFact({
        catId,
        fact: trimmed,
        category: draftCategory,
        source: 'manual',
      });
      setDraft('');
      setShowAdd(false);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const onDelete = (fact: SelfFact) => {
    Alert.alert(
      `Forget this?`,
      `${catName} will no longer reference: "${fact.fact}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => deleteFact(catId, fact.id),
        },
      ],
    );
  };

  return (
    <View style={{ marginTop: space[5] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: space[3],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text token="caption" color="textMuted" style={styles.eyebrow}>
            What {catName} knows about themselves
          </Text>
          <Text
            token="body"
            color="textMuted"
            style={{ marginTop: 2, lineHeight: 19 }}
          >
            Tell {catName} something in chat, or add it directly here. {catName} remembers and weaves these into the diary.
          </Text>
        </View>
      </View>

      {facts.length === 0 ? (
        <View
          style={[
            selfFactsStyles.empty,
            { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle },
          ]}
        >
          <Text token="body" color="textMuted" style={{ textAlign: 'center', lineHeight: 21 }}>
            Nothing yet. Tell {catName} something in chat — &ldquo;you love tuna&rdquo; — and it shows up here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          {facts.map((f) => (
            <View
              key={f.id}
              style={[
                selfFactsStyles.factRow,
                { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text token="body" style={{ color: t.textPrimary, lineHeight: 21 }}>
                  {f.fact}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <View
                    style={[
                      selfFactsStyles.categoryPill,
                      { backgroundColor: t.secondary50, borderColor: t.secondary500 },
                    ]}
                  >
                    <Text
                      token="caption"
                      style={{
                        color: t.secondary900,
                        fontSize: 10,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                      }}
                    >
                      {f.category}
                    </Text>
                  </View>
                  {f.assertion_count > 1 ? (
                    <Text token="caption" color="textMuted" style={{ fontSize: 11 }}>
                      said {f.assertion_count}×
                    </Text>
                  ) : null}
                  {f.source === 'manual' ? (
                    <Text token="caption" color="textMuted" style={{ fontSize: 11 }}>
                      typed
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={() => onDelete(f)}
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
                accessibilityLabel={`Forget that ${f.fact}`}
              >
                <X size={16} color={t.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Add form */}
      {showAdd ? (
        <View
          style={[
            selfFactsStyles.addCard,
            { backgroundColor: t.surfaceElevated, borderColor: t.borderSubtle },
          ]}
        >
          <Text token="caption" color="textMuted" style={styles.eyebrow}>
            Tell {catName} something
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`e.g. I love tuna. / I am afraid of the vacuum.`}
            placeholderTextColor={t.textMuted}
            multiline
            style={[
              selfFactsStyles.input,
              {
                color: t.textPrimary,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
              },
            ]}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space[2] }}>
            {CATEGORY_OPTIONS.map((c) => {
              const active = draftCategory === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setDraftCategory(c)}
                  style={({ pressed }) => [
                    selfFactsStyles.categoryChip,
                    {
                      backgroundColor: active ? t.secondary100 : t.surface,
                      borderColor: active ? t.secondary500 : t.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    token="caption"
                    style={{
                      color: active ? t.secondary900 : t.textPrimary,
                      fontFamily: active ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
                      fontSize: 11,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: space[3] }}>
            <Pressable
              onPress={() => {
                setShowAdd(false);
                setDraft('');
              }}
              style={({ pressed }) => [
                selfFactsStyles.actionBtn,
                { borderColor: t.borderStrong, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onAdd}
              disabled={!draft.trim()}
              style={({ pressed }) => [
                selfFactsStyles.actionBtn,
                {
                  backgroundColor: draft.trim() ? t.primary500 : t.surfaceSunken,
                  borderColor: draft.trim() ? t.primary500 : t.borderSubtle,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                token="caption"
                style={{
                  color: draft.trim() ? t.textInverse : t.textMuted,
                  fontFamily: 'Figtree_600SemiBold',
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [
            selfFactsStyles.addBtn,
            {
              backgroundColor: t.surfaceElevated,
              borderColor: t.borderStrong,
              borderStyle: 'dashed',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Plus size={14} color={t.textPrimary} weight="bold" />
          <Text token="caption" style={{ color: t.textPrimary, fontFamily: 'Figtree_600SemiBold' }}>
            Add a self-fact
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const selfFactsStyles = StyleSheet.create({
  empty: {
    padding: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  addCard: {
    marginTop: space[3],
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontFamily: 'Figtree_400Regular',
    fontSize: 14,
    minHeight: 60,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space[2],
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  eyebrow: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  depthCard: {
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  depthTrack: {
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  depthFill: {
    height: '100%',
    borderRadius: 999,
  },
  milestoneCallout: {
    marginTop: space[4],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  facetCard: {
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  facetBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  stageTrack: {
    height: 4,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stageFill: {
    height: '100%',
    borderRadius: 999,
  },
  closingNote: {
    marginTop: space[5],
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
