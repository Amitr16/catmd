/**
 * PhotoIdentityPill — small overlay badge on a photo thumbnail.
 *
 * Renders ONLY when the identity-match result needs the user's
 * attention — high-confidence single-cat photos stay silent. The pill
 * communicates one of:
 *
 *   ⚠ "not [name]?"   — the target cat wasn't detected (other cat(s)
 *      in frame OR no Lily-shaped cat found). Tells the user this
 *      photo will be excluded from postcard/poster/diary attribution
 *      until they confirm or replace.
 *   ?  "[name]?"      — multi-cat detected with low-confidence match.
 *      AI thinks the target is in there but can't be sure which one.
 *      User can manually confirm.
 *
 * Earlier copy was just "verify" / "?" which the user (correctly)
 * flagged as ambiguous: "what does verify mean?" The new labels
 * use a literal question form ("not Lily?", "Lily?") so the pill
 * speaks plainly — the user immediately understands the AI is
 * uncertain about whether this photo is of their cat.
 *
 * Stays absent when:
 *   - identity check hasn't completed yet (cat_count undefined)
 *   - single cat in frame (catCount === 1)
 *   - target found with confidence ≥ floor
 *   - user has explicitly confirmed via the user_confirmed flag
 *
 * Visual: small pill in the bottom-right corner of the thumbnail,
 * 65% translucent dark backdrop + warning-coloured border + tiny
 * icon. Doesn't disrupt the photo composition.
 *
 * Tap-to-resolve UX (confirmation modal) is intentionally Tier 2 —
 * Tier 1 surfaces the warning so users can manually fix the photo
 * by retaking or editing the gallery. Tier 2 will add tap-to-confirm
 * with a "Yes / No / Cancel" sheet.
 */
import { View } from 'react-native';
import { Question, WarningCircle } from 'phosphor-react-native';
import { Text } from './Text';
import { useTheme } from '../theme/useTheme';
import { IDENTITY_CONFIDENCE_FLOOR } from '../services/identityMatch';
import type { PhotoStudioPhoto } from '../services/photoStudio';

type PillKind = 'not_found' | 'low_confidence' | null;

/** Pure decision: which (if any) pill should this photo render? */
export function pillKindFor(photo: PhotoStudioPhoto): PillKind {
  // Identity check not run yet — stay silent.
  if (photo.cat_count === undefined) return null;
  // User has confirmed manually — never warn again.
  if (photo.target_user_confirmed) return null;
  // No cats in image at all — out of scope for this pill.
  if (photo.cat_count === 0) return null;
  // Single cat + match → silent good case.
  if (photo.cat_count === 1 && photo.target_present !== false) return null;

  // Target not present at all.
  if (photo.target_present === false) return 'not_found';

  // Multi-cat with low-confidence match.
  if (
    photo.cat_count > 1 &&
    (photo.target_confidence ?? 0) < IDENTITY_CONFIDENCE_FLOOR
  ) {
    return 'low_confidence';
  }

  return null;
}

type Size = 'xs' | 'sm';

export function PhotoIdentityPill({
  photo,
  catName,
  size = 'sm',
}: {
  photo: PhotoStudioPhoto;
  /** Cat's name. Used in the pill label so it reads as a literal
   *  question ("not Lily?" / "Lily?"). When omitted, falls back to
   *  generic copy. */
  catName?: string | null;
  size?: Size;
}) {
  const t = useTheme();
  const kind = pillKindFor(photo);
  if (!kind) return null;

  const small = size === 'xs';
  const iconSize = small ? 10 : 12;
  const fontSize = small ? 9 : 10;
  const paddingH = small ? 4 : 6;
  const paddingV = small ? 2 : 3;
  const name = catName?.trim() || 'Lily';

  // Distinct icon per kind. Both use the warning palette — keeping
  // UI consistent without introducing a "danger red" that'd read as
  // urgent / clinical (the pill is informational, not alarming).
  const Icon = kind === 'not_found' ? WarningCircle : Question;
  const label =
    kind === 'not_found'
      ? `not ${name}?`
      : `${name}?`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: paddingH,
        paddingVertical: paddingV,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderWidth: 1,
        borderColor: t.warning,
      }}
    >
      <Icon size={iconSize} color={t.warning} weight="fill" />
      {!small ? (
        <Text
          token="caption"
          style={{
            color: '#fff',
            fontFamily: 'Figtree_600SemiBold',
            fontSize,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
