/**
 * Install attribution — pure parser.
 *
 * Extracted from installAttribution.ts so the parsing logic can be
 * tested in pure Node (scripts/test-install-attribution.mjs) without
 * pulling in the native install-referrer module's import chain.
 *
 * No I/O, no native dependencies — just a referrer-URL → typed-shape
 * transformer. Marketing attribution is downstream of this parser; a
 * regression here would silently break every funnel.
 */

/** UTM + campaign-attribution fields parsed from the install referrer. */
export type InstallAttribution = {
  utm_source: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_medium?: string;
  utm_term?: string;
  campaign_id?: string;
  creative_id?: string;
  /** Raw referrer URL kept for debugging / future re-parsing. May be ''. */
  raw_referrer_url?: string;
  /** True when this is the organic default (no real referrer captured). */
  is_organic: boolean;
};

/** Hard-coded organic default — returned when no referrer is captured. */
export const ORGANIC_DEFAULT: InstallAttribution = {
  utm_source: 'organic',
  is_organic: true,
};

/**
 * Parse a referrer URL query string into the attribution shape. The
 * referrer payload from Google Play looks like a URL-encoded query
 * string (NOT a full URL):
 *   `utm_source=google&utm_campaign=spring_sale&campaign_id=12345`
 *
 * Pure function — no I/O, fully testable. Returns the organic default
 * if the input doesn't yield any usable fields.
 */
export function parseReferrerUrl(referrerUrl: string | undefined | null): InstallAttribution {
  if (!referrerUrl || typeof referrerUrl !== 'string') return ORGANIC_DEFAULT;

  // URLSearchParams accepts the body directly (no `?` prefix needed).
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(referrerUrl);
  } catch {
    return ORGANIC_DEFAULT;
  }

  const utm_source = params.get('utm_source')?.trim() || '';
  const utm_campaign = params.get('utm_campaign')?.trim() || undefined;
  const utm_content = params.get('utm_content')?.trim() || undefined;
  const utm_medium = params.get('utm_medium')?.trim() || undefined;
  const utm_term = params.get('utm_term')?.trim() || undefined;
  const campaign_id = params.get('campaign_id')?.trim() || undefined;
  const creative_id = params.get('creative_id')?.trim() || undefined;

  // If we got NOTHING usable, return organic default with the raw URL
  // attached for debugging.
  if (
    !utm_source &&
    !utm_campaign &&
    !utm_content &&
    !campaign_id &&
    !creative_id
  ) {
    return { ...ORGANIC_DEFAULT, raw_referrer_url: referrerUrl };
  }

  return {
    utm_source: utm_source || 'organic',
    is_organic: !utm_source || utm_source.toLowerCase() === 'organic',
    ...(utm_campaign ? { utm_campaign } : {}),
    ...(utm_content ? { utm_content } : {}),
    ...(utm_medium ? { utm_medium } : {}),
    ...(utm_term ? { utm_term } : {}),
    ...(campaign_id ? { campaign_id } : {}),
    ...(creative_id ? { creative_id } : {}),
    raw_referrer_url: referrerUrl,
  };
}
