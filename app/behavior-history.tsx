/**
 * Body Language history — past readings the cat has accumulated.
 *
 * ── Why this screen exists ─────────────────────────────────────────
 * Every body-language reading is saved to `healthStore` as a
 * `behavior_observation` event. Those observations feed:
 *   - chat memory ("Recent behaviour observations" in the prompt)
 *   - personality scoring (FelineFive vector via `behaviorObsVector`)
 *   - diary entries (today's observations woven in)
 *   - becoming/depth progression
 *   - world memory (parallel vision pass on the same frames)
 *
 * Pre-2026-05-07 there was NO UI to view past readings — the user
 * ran a reading, saw the result once, and it disappeared from view
 * forever (though it kept feeding everything behind the scenes).
 * This screen fixes that.
 *
 * ── Layout ──────────────────────────────────────────────────────────
 *   Header (back + title + count)
 *   Empty state if no readings yet
 *   List of past readings, newest first:
 *     - Date label ("Today", "Yesterday", "3 days ago", or absolute)
 *     - "Most likely:" headline (the cat's interpretive line)
 *     - Tag pills (top 4)
 *     - Tap to expand → full ObservationBody + notes textarea
 *   Bottom CTA: "Record a new reading" → /behavior
 *
 * ── Data source ─────────────────────────────────────────────────────
 * `useHealthStore(s => s.events)` filtered to type='behavior_observation'
 * and the active cat, sorted by `ts` descending. Cloud-sync handles
 * cross-device restore via cat_events table.
 *
 * ── Notes capability ───────────────────────────────────────────────
 * The `notes` field has been in the `BehaviorObservationPayload` type
 * since launch but no UI ever wrote to it. This screen surfaces a
 * small textarea on the expanded card so users can annotate readings
 * after the fact ("she'd just had her dinner", "this was right
 * before the vet visit"). Notes round-trip through `updateEvent`
 * which already cloud-syncs.
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
  CaretDown,
  CaretRight,
  Eye,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
} from 'phosphor-react-native';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/Button';
import { ObservationBody } from '../src/components/ObservationBody';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useActiveCat } from '../src/hooks/useActiveCat';
import { useHealthStore, type HealthEvent } from '../src/state/healthStore';
import { track } from '../src/services/analytics';
import { useLocalSearchParams } from 'expo-router';

// ─── Types ─────────────────────────────────────────────────────────

type BehaviorObs = HealthEvent<'behavior_observation'>;

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Pull the headline from a reading's observation. The model emits a
 * "Most likely:" line as the interpretive verdict; if it's there we
 * use that. Falls back to the first non-channel-label sentence, then
 * to a fixed string. Capped at ~120 chars for the list row.
 */
function extractHeadline(observation: string): string {
  if (!observation) return 'Reading captured.';
  const mostLikely = observation.match(/Most likely:\s*([\s\S]+?)(?:\n\n|$)/i);
  if (mostLikely && mostLikely[1]) {
    return mostLikely[1].trim().split(/\n/)[0].slice(0, 160);
  }
  // Defensive fallback: legacy unstructured observations.
  const firstSentence = observation.split(/[.!?]\s/)[0];
  return firstSentence.slice(0, 160);
}

/**
 * Friendly relative-date label. "Today" / "Yesterday" / "N days ago"
 * for the recent past; absolute YYYY-MM-DD beyond ~30 days.
 */
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

/**
 * Time-of-day label, "9:42 AM" — pairs with the relative date so the
 * row carries enough context without expanding ("Today, 9:42 AM").
 */
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

export default function BehaviorHistoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useActiveCat();

  // Subscribe to the events array and filter inside useMemo so we
  // re-render only on actual changes. The store's listByType is a
  // selector function (not reactive), so we go through the raw array.
  const events = useHealthStore((s) => s.events);
  const observations = useMemo<BehaviorObs[]>(() => {
    if (!cat?.id) return [];
    return events
      .filter(
        (e): e is BehaviorObs =>
          e.cat_id === cat.id && e.type === 'behavior_observation',
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [events, cat?.id]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Source-attributed open telemetry ──────────────────────────────
  // The route accepts a ?source=... param so we know whether the user
  // arrived via the mode-picker link, the post-reading "View all"
  // CTA, or a direct deep-link/back-nav (default).
  const params = useLocalSearchParams<{ source?: string }>();
  useEffect(() => {
    if (!cat?.id) return;
    const raw = (params.source ?? '').toString();
    const source: 'mode_picker' | 'done_stage' | 'direct' =
      raw === 'mode_picker' || raw === 'done_stage' ? raw : 'direct';
    track({
      type: 'behavior_history_opened',
      props: { reading_count: observations.length, source },
    });
    // Intentionally only when cat changes — not on every observations
    // bump, which would spam the event when the user records a fresh
    // reading from the bottom CTA and navigates back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.id]);

  if (!cat) {
    return (
      <View style={[styles.container, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} title="History" />
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
        title={`${cat.name}'s readings`}
        subtitle={
          observations.length > 0
            ? `${observations.length} ${observations.length === 1 ? 'reading' : 'readings'} on file`
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
        {/* Intro card — short context on what these are + how they're used.
            Helps justify the "every reading is saved + helps the cat learn"
            promise. */}
        <View style={[styles.introCard, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
          <View style={styles.introHeader}>
            <Sparkle size={18} color={t.primary500} weight="duotone" />
            <Text token="body" style={{ marginLeft: space[2], color: t.textPrimary, fontWeight: '600' }}>
              How {cat.name} uses these
            </Text>
          </View>
          <Text token="caption" color="textSecondary" style={{ marginTop: space[2], lineHeight: 18 }}>
            Every body-language reading is saved here. {cat.name} pulls
            from them in chat ("the way I was sitting last week…"), they
            shape {cat.name}'s personality, and they feed the diary.
            Add a private note to any reading to remember the context.
          </Text>
        </View>

        {/* Empty state */}
        {observations.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: t.surfaceSunken, borderColor: t.borderSubtle }]}>
            <Eye size={28} color={t.textMuted} weight="duotone" />
            <Text token="body" color="textSecondary" style={{ textAlign: 'center', marginTop: space[3] }}>
              No readings yet.
            </Text>
            <Text token="caption" color="textMuted" style={{ textAlign: 'center', marginTop: space[1] }}>
              Record a 6-second video of {cat.name} and the AI reads
              the room — posture, ears, tail, voice. The reading
              lands here.
            </Text>
            <View style={{ marginTop: space[4] }}>
              <Button
                label="Record a reading"
                onPress={() => router.replace('/behavior' as never)}
              />
            </View>
          </View>
        ) : null}

        {/* List */}
        {observations.map((obs) => (
          <ReadingRow
            key={obs.id}
            obs={obs}
            isExpanded={expandedId === obs.id}
            onToggle={() =>
              setExpandedId((cur) => (cur === obs.id ? null : obs.id))
            }
          />
        ))}

        {/* Bottom CTA — only when there ARE readings, otherwise the
            empty state's button covers it */}
        {observations.length > 0 ? (
          <Pressable
            onPress={() => router.replace('/behavior' as never)}
            style={[styles.recordCta, { borderColor: t.primary500 }]}
          >
            <Plus size={18} color={t.primary500} weight="bold" />
            <Text token="body" style={{ color: t.primary500, marginLeft: space[2], fontWeight: '600' }}>
              Record a new reading
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

function ReadingRow({
  obs,
  isExpanded,
  onToggle,
}: {
  obs: BehaviorObs;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const updateEvent = useHealthStore((s) => s.updateEvent);
  const deleteEvent = useHealthStore((s) => s.deleteEvent);

  const observationText = obs.payload.observation ?? '';
  const tags = obs.payload.tags ?? [];
  const headline = useMemo(() => extractHeadline(observationText), [observationText]);

  const initialNote = obs.payload.notes ?? '';
  const [noteDraft, setNoteDraft] = useState(initialNote);
  const [editingNote, setEditingNote] = useState(false);

  // Reset draft when the underlying record changes (e.g. cloud restore
  // pulled a fresh copy with a different note).
  useEffect(() => {
    setNoteDraft(initialNote);
    setEditingNote(false);
  }, [obs.id, initialNote]);

  const saveNote = () => {
    const trimmed = noteDraft.trim();
    // Persist the empty-string-as-cleared case as null so the schema
    // intent (notes: string | null) is preserved.
    updateEvent<'behavior_observation'>(obs.id, {
      notes: trimmed.length === 0 ? null : trimmed,
    });
    track({
      type: 'behavior_note_saved',
      props: {
        is_first_note: !initialNote,
        note_length: trimmed.length,
      },
    });
    setEditingNote(false);
  };

  const onDelete = () => {
    Alert.alert(
      'Delete this reading?',
      "It'll be removed from the cat's memory and chat won't reference it again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(obs.id);
            track({ type: 'behavior_observation_deleted' });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.rowCard, { backgroundColor: t.surface, borderColor: t.borderSubtle }]}>
      {/* Tappable header */}
      <Pressable onPress={onToggle} style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.dateRow}>
            <Text token="caption" style={{ color: t.textPrimary, fontWeight: '600' }}>
              {relativeDate(obs.ts)}
            </Text>
            <Text token="caption" color="textMuted" style={{ marginLeft: space[2] }}>
              · {timeOfDay(obs.ts)}
            </Text>
            {obs.payload.notes ? (
              <View style={[styles.noteIndicator, { backgroundColor: t.secondary100 }]}>
                <PencilSimple size={10} color={t.secondary700} weight="fill" />
              </View>
            ) : null}
          </View>
          <Text
            token="body"
            style={{ color: t.textPrimary, marginTop: space[1], lineHeight: 20 }}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {headline}
          </Text>
          {/* Top-3 tags peek when collapsed. Full tag set rendered on
              expand below. */}
          {!isExpanded && tags.length > 0 ? (
            <View style={styles.tagPeek}>
              {tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagPill, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}
                >
                  <Text token="caption" style={{ color: t.textSecondary, fontSize: 11 }}>
                    {tag}
                  </Text>
                </View>
              ))}
              {tags.length > 3 ? (
                <Text token="caption" color="textMuted" style={{ fontSize: 11, marginLeft: space[1] }}>
                  +{tags.length - 3}
                </Text>
              ) : null}
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
          {/* Full reading text rendered with the same component used on
              the live "done" screen, so labels stay bold + structured. */}
          <ObservationBody text={observationText} />

          {/* All tags as pills */}
          {tags.length > 0 ? (
            <View style={styles.tagRowFull}>
              {tags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagPill, { borderColor: t.borderSubtle, backgroundColor: t.surfaceSunken }]}
                >
                  <Text token="caption" style={{ color: t.textSecondary }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Notes block — read-only by default, switches to editor
              when the user taps "Add note" / the existing note. */}
          <View style={[styles.notesBlock, { borderTopColor: t.borderSubtle }]}>
            <View style={styles.notesHeader}>
              <PencilSimple size={14} color={t.textSecondary} weight="duotone" />
              <Text token="caption" style={{ marginLeft: space[1], color: t.textSecondary, fontWeight: '600' }}>
                Your note
              </Text>
            </View>

            {editingNote ? (
              <>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Add context — what was happening, who was around, anything to remember about this reading…"
                  placeholderTextColor={t.textMuted}
                  multiline
                  style={[
                    styles.noteInput,
                    {
                      color: t.textPrimary,
                      borderColor: t.borderSubtle,
                      backgroundColor: t.surfaceSunken,
                    },
                  ]}
                  maxLength={400}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onPress={() => {
                        setNoteDraft(initialNote);
                        setEditingNote(false);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Save"
                      size="sm"
                      fullWidth
                      onPress={saveNote}
                    />
                  </View>
                </View>
              </>
            ) : initialNote ? (
              <Pressable onPress={() => setEditingNote(true)}>
                <Text
                  token="body"
                  style={{ color: t.textPrimary, marginTop: space[1], lineHeight: 20 }}
                >
                  {initialNote}
                </Text>
                <Text token="caption" color="textMuted" style={{ marginTop: space[1] }}>
                  Tap to edit
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setEditingNote(true)}
                style={[styles.addNoteButton, { borderColor: t.borderSubtle }]}
              >
                <Plus size={14} color={t.textSecondary} weight="bold" />
                <Text token="caption" style={{ marginLeft: space[1], color: t.textSecondary }}>
                  Add a note
                </Text>
              </Pressable>
            )}
          </View>

          {/* Footer actions — delete sits here so it's deliberate
              (only visible after expand) */}
          <View style={[styles.expandedFooter, { borderTopColor: t.borderSubtle }]}>
            <Pressable onPress={onDelete} style={styles.deleteAction} hitSlop={8}>
              <Trash size={14} color={t.error} weight="bold" />
              <Text token="caption" style={{ marginLeft: space[1], color: t.error, fontWeight: '600' }}>
                Delete reading
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
  noteIndicator: {
    marginLeft: space[2],
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  notesBlock: {
    marginTop: space[4],
    paddingTop: space[3],
    borderTopWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteInput: {
    marginTop: space[2],
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  addNoteButton: {
    marginTop: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
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
