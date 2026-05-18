/**
 * Cat Personality Test — /cat-personality-test
 *
 * SEO target: "cat personality test" (currently rank: null; #1 is 16tests.com).
 * Format mismatch is why we don't rank — they have a real interactive quiz,
 * we had only a framework explainer. This page is the quiz: 10 questions
 * scoring against the Feline Five (Litchfield 2017 PLoS One), returning
 * one of 9 archetypes that map to the framework already explained in
 * /library/feline-five-personality-framework.
 *
 * Why client-side only:
 *   - No PII collected → no server roundtrip needed → instant result
 *   - Page renders complete in one Worker call → 5ms TTFB
 *   - Quiz state lives in memory; sharing copies the result URL
 *
 * Scoring math:
 *   10 questions, each scores 1-5 on a single trait.
 *   2 questions per trait → max 10 / min 2 per trait.
 *   Normalised to 0-100 → trait scores.
 *   Archetype = best fit by Euclidean distance to archetype prototypes
 *   defined in the ARCHETYPE_PROFILES constant.
 *
 * SEO value beyond ranking: highly shareable result → social backlinks →
 * lifts domain authority for the rest of the library.
 */
import {
  buildPlayStoreUrl,
  renderAnalyticsScripts,
  renderSearchConsoleMeta,
} from './seoAndAnalytics';

const SITE_URL = 'https://catmd.pet';
const PAGE_URL = `${SITE_URL}/cat-personality-test`;
const PAGE_TITLE = 'Cat Personality Test — Free 10-Question Quiz (Feline Five Framework)';
const PAGE_DESCRIPTION =
  "Find your cat's personality archetype in 2 minutes. Free 10-question test based on the Feline Five research framework — discover whether your cat is a Velcro, Hunter, Skittish-Sensitive, Goofball, or Cool Observer.";

interface QuizQuestion {
  /** Trait this question scores. */
  trait: 'skittishness' | 'outgoingness' | 'dominance' | 'spontaneity' | 'friendliness';
  /** The question text. */
  text: string;
  /** Answer options, ordered from lowest trait score (1) to highest (5). */
  options: string[];
  /** If true, scoring is inverted (option 1 = score 5, option 5 = score 1). */
  reverse?: boolean;
}

const QUESTIONS: QuizQuestion[] = [
  // ── Skittishness (2 questions) ──────────────────────────────────────────
  {
    trait: 'skittishness',
    text: "A stranger rings the doorbell. How does your cat react?",
    options: [
      "Doesn't even glance up — totally unfazed",
      "Notices, then carries on as if nothing happened",
      "Watches alertly from a safe distance",
      "Hides briefly, then peeks out cautiously",
      "Bolts under the bed and stays hidden for hours",
    ],
  },
  {
    trait: 'skittishness',
    text: "You drop a heavy book on the floor by accident. Your cat:",
    options: [
      "Barely flinches",
      "Twitches, then settles in seconds",
      "Startles, runs a few paces, comes back",
      "Runs to a safe spot and watches warily for a while",
      "Disappears completely — won't be seen for the rest of the day",
    ],
  },
  // ── Outgoingness (2 questions) ──────────────────────────────────────────
  {
    trait: 'outgoingness',
    text: "When you come home after being out, your cat usually:",
    options: [
      "Stays wherever she is — barely acknowledges you",
      "Looks up but doesn't move",
      "Wanders over eventually for a sniff",
      "Comes to greet you with a meow or tail-up",
      "Runs to the door and demands attention immediately",
    ],
  },
  {
    trait: 'outgoingness',
    text: "When a new person sits on your sofa, your cat:",
    options: [
      "Avoids the room entirely until they leave",
      "Watches warily from across the room",
      "Observes from a perch, doesn't approach",
      "Investigates with cautious sniffing eventually",
      "Climbs straight into their lap",
    ],
  },
  // ── Dominance (2 questions) ─────────────────────────────────────────────
  {
    trait: 'dominance',
    text: "At feeding time (or with treats), your cat:",
    options: [
      "Waits patiently, lets others go first",
      "Eats next to others without conflict",
      "Has her own bowl and is mildly territorial",
      "Pushes ahead of other cats or pets",
      "Guards her food and chases others away from theirs too",
    ],
  },
  {
    trait: 'dominance',
    text: "For the best sleeping spot in the house, your cat:",
    options: [
      "Takes whatever spot is left over",
      "Shares spots peacefully with others",
      "Has her own favourite and respects others'",
      "Claims one prime spot consistently and defends it",
      "Displaces other cats or pets from wherever they're sitting",
    ],
  },
  // ── Spontaneity (2 questions) ───────────────────────────────────────────
  {
    trait: 'spontaneity',
    text: "How predictable is your cat's day-to-day routine?",
    options: [
      "Almost identical every day — meal, nap, window, nap",
      "Mostly predictable with small variations",
      "Mix of routine and surprise",
      "Frequent random bursts of activity or behaviour",
      "Completely unpredictable — never know what she'll do next",
    ],
  },
  {
    trait: 'spontaneity',
    text: "Zoomies — sudden mad dashes through the house — happen:",
    options: [
      "Almost never",
      "Rarely, maybe once a month",
      "Sometimes, a few times a week",
      "Often — most evenings",
      "Multiple times a day, sometimes for no clear reason",
    ],
  },
  // ── Friendliness (2 questions) ──────────────────────────────────────────
  {
    trait: 'friendliness',
    text: "Your cat's relationship with physical touch:",
    options: [
      "Actively avoids being petted",
      "Tolerates brief touch but walks away",
      "Enjoys head and chin scritches but not body strokes",
      "Seeks regular cuddles and lap time",
      "Cannot get enough physical contact — touch-seeking constantly",
    ],
  },
  {
    trait: 'friendliness',
    text: "When you sleep, your cat:",
    options: [
      "Sleeps somewhere completely separate from you",
      "Sleeps in the same room but not on the bed",
      "Sleeps on the bed but not close to you",
      "Curls near your feet or against your side",
      "Sleeps on your pillow, chest, or directly on top of you",
    ],
  },
];

interface ArchetypeProfile {
  id: string;
  name: string;
  emoji: string;
  /** One-line summary shown on the result card. */
  tagline: string;
  /** 3-4 sentence detail shown on the result page. */
  description: string;
  /** Lifestyle implications — concrete advice based on the archetype. */
  lifestyle: string;
  /** Trait prototype on the 0-100 scale. Closest match wins. */
  prototype: {
    skittishness: number;
    outgoingness: number;
    dominance: number;
    spontaneity: number;
    friendliness: number;
  };
}

const ARCHETYPES: ArchetypeProfile[] = [
  {
    id: 'velcro-cat',
    name: 'The Velcro Cat',
    emoji: '🧲',
    tagline: 'Follows you to the bathroom. Lives on your lap.',
    description:
      "Extreme attachment, high outgoingness, high friendliness. Your cat is the kind that doesn't just live with you — she lives ON you. She follows you room to room, complains when you close a door, and considers your lap her personal real estate. Common in Sphynx, Siamese, and many Oriental breeds.",
    lifestyle:
      'Separation distress is a real risk. Consider a feline companion if you work long hours. Vocal demands for attention are normal — not a behaviour problem. Pet her often and on her terms; she will tell you when she wants more.',
    prototype: { skittishness: 30, outgoingness: 95, dominance: 40, spontaneity: 55, friendliness: 95 },
  },
  {
    id: 'confident-sociable',
    name: 'The Confident-Sociable',
    emoji: '🌟',
    tagline: "Meets every visitor at the door. Thinks she's the host.",
    description:
      "High outgoingness, low skittishness, moderate dominance. Your cat is the rare one who treats the doorbell as a chance to make new friends. Adapts well to new environments, multi-cat homes, and even travel. Common in Maine Coons, Sphynx, and Bengals.",
    lifestyle:
      'Daily interaction is non-negotiable — she will not be happy left alone for 10-hour workdays. Often benefits from a feline companion. Excellent candidate for harness training or supervised outdoor time.',
    prototype: { skittishness: 15, outgoingness: 85, dominance: 60, spontaneity: 50, friendliness: 75 },
  },
  {
    id: 'curious-introvert',
    name: 'The Curious Introvert',
    emoji: '🔍',
    tagline: 'Confident at home, reserved with strangers. Watches everything.',
    description:
      "Moderate outgoingness, low-moderate skittishness, low dominance. Your cat is bold in her own territory but takes time to warm up to guests. Quietly curious, explores on her own terms, and forms deep bonds with one or two specific humans. Common in Russian Blues.",
    lifestyle:
      'Thrives on routine. Does better in quieter households. Needs a designated safe-room during gatherings. Don\'t force introductions to strangers — let her come out when she\'s ready.',
    prototype: { skittishness: 40, outgoingness: 50, dominance: 30, spontaneity: 40, friendliness: 60 },
  },
  {
    id: 'anxious-sensitive',
    name: 'The Anxious-Sensitive',
    emoji: '🌿',
    tagline: 'Easily overwhelmed. Takes weeks to settle into change.',
    description:
      "High skittishness, low outgoingness, low dominance. Your cat reads the world as full of surprises she didn't sign up for. Often the result of inadequate kitten socialisation, but also common in some genetic lines. Slow to trust — and worth the patience.",
    lifestyle:
      'Stable schedules, predictable handling, environmental enrichment focused on hiding spots and elevated perches. Avoid loud households, frequent guests, and forceful introductions. Feliway diffusers often help.',
    prototype: { skittishness: 85, outgoingness: 25, dominance: 20, spontaneity: 30, friendliness: 45 },
  },
  {
    id: 'hunter-athlete',
    name: 'The Hunter-Athlete',
    emoji: '🐆',
    tagline: 'Wand toys are non-negotiable. Knocks things off tables — for fun.',
    description:
      "High spontaneity, low skittishness, high outgoingness. Your cat is built for the hunt and bored without an outlet for it. Athletic, focused, prey-driven, with the kind of intensity that makes a wand toy a serious workout. Common in Bengals, Abyssinians, and Savannahs.",
    lifestyle:
      'Provide 15-20 minutes of intense daily wand-toy play. Food puzzles, vertical territory, and ideally a catio or harness-walk option. Without enough physical outlet, energy turns into destructive behaviour.',
    prototype: { skittishness: 20, outgoingness: 75, dominance: 65, spontaneity: 90, friendliness: 60 },
  },
  {
    id: 'affectionate-lap',
    name: 'The Affectionate-Lap',
    emoji: '💗',
    tagline: 'The classic lap cat. Purrs at the slightest touch.',
    description:
      "High friendliness, high outgoingness, low dominance. Your cat is the storybook companion — seeks physical contact, purrs readily, sleeps on the bed, tolerates handling well. Common in Ragdolls, Birmans, and Scottish Folds.",
    lifestyle:
      'Thrives on close human contact. Does badly when left alone for extended periods. Excellent with gentle children. Pet her often, hold her sometimes (she\'ll usually tell you when she\'s had enough).',
    prototype: { skittishness: 25, outgoingness: 80, dominance: 30, spontaneity: 35, friendliness: 90 },
  },
  {
    id: 'skittish-sensitive',
    name: 'The Skittish-Sensitive',
    emoji: '🌙',
    tagline: 'Slow to trust. Deeply bonded once she does.',
    description:
      "High skittishness, low outgoingness, moderate friendliness with bonded humans only. Your cat is a long-game relationship — she will hide from strangers for years, but she'll have already chosen you. Common in Russian Blues with poor early socialisation and many rescue cats.",
    lifestyle:
      'Respect her pace. Never force interaction. Expect 6-12 months for full bonding. Once she trusts you, the affection is intense and quiet — chin rubs, slow blinks, sleeping near you but rarely on you.',
    prototype: { skittishness: 80, outgoingness: 30, dominance: 25, spontaneity: 35, friendliness: 65 },
  },
  {
    id: 'cool-observer',
    name: 'The Cool Observer',
    emoji: '🪶',
    tagline: 'Watches everything. Reacts to little. Affection on her terms.',
    description:
      "Low outgoingness, low skittishness, low spontaneity. Your cat is the cat-shaped equivalent of a long-time housemate who likes you but doesn't want to be picked up. Steady, observant, unflappable. Common in British Shorthairs.",
    lifestyle:
      "Don't take her reserve personally — it's not coldness, it's how she's wired. Affection comes on her terms, often as quiet companionship rather than physical contact. Routine and predictability suit her.",
    prototype: { skittishness: 25, outgoingness: 30, dominance: 40, spontaneity: 20, friendliness: 50 },
  },
  {
    id: 'goofball-playful',
    name: 'The Goofball',
    emoji: '🎪',
    tagline: 'Plays fetch. Falls off things. Class clown energy.',
    description:
      "High spontaneity, high outgoingness, high friendliness, low dominance. Your cat is the class clown of cats — knocks things off tables on purpose, plays fetch, gets into harmless mischief. Often common in Domestic Shorthairs.",
    lifestyle:
      'Enrichment is crucial. Bored Goofballs become destructive Goofballs. Rotate toys weekly, hide treats around the home, and play with her every day. She will reward you with the consistent entertainment of her own existence.',
    prototype: { skittishness: 25, outgoingness: 75, dominance: 30, spontaneity: 85, friendliness: 80 },
  },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPersonalityTest(): string {
  const playUrl = buildPlayStoreUrl('tool', 'cat-personality-test');

  // Schema.org — Quiz type with Question schema for each.
  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    'name': 'Cat Personality Test',
    'about': 'The Feline Five personality framework',
    'numberOfQuestions': QUESTIONS.length,
    'url': PAGE_URL,
    'educationalLevel': 'beginner',
    'learningResourceType': 'quiz',
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'CatMD', 'item': SITE_URL },
      { '@type': 'ListItem', 'position': 2, 'name': 'Cat Personality Test', 'item': PAGE_URL },
    ],
  };

  // Embed question + archetype data into a runtime-safe JSON blob.
  // The client-side script reads this to render and score the quiz.
  const quizData = JSON.stringify({
    questions: QUESTIONS,
    archetypes: ARCHETYPES,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#FAF7F2" />
<title>${escapeHtml(PAGE_TITLE)}</title>
<meta name="description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<link rel="canonical" href="${PAGE_URL}" />
${renderSearchConsoleMeta()}
${renderAnalyticsScripts()}
<meta property="og:title" content="${escapeHtml(PAGE_TITLE)}" />
<meta property="og:description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${PAGE_URL}" />
<meta property="og:site_name" content="CatMD" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(PAGE_TITLE)}" />
<meta name="twitter:description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='34' r='20' fill='%233F6456'/%3E%3Cpath d='M16 22 L20 10 L26 24 Z' fill='%233F6456'/%3E%3Cpath d='M48 22 L44 10 L38 24 Z' fill='%233F6456'/%3E%3Ccircle cx='26' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3Ccircle cx='38' cy='32' r='2.4' fill='%23FAF7F2'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600;700&display=swap" />
<script type="application/ld+json">${JSON.stringify(quizSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<style>
  :root {
    --cream:#FAF7F2; --cream-2:#F4EFE5; --sage:#3F6456; --sage-dark:#25403A;
    --sage-soft:#DCE6DE; --terracotta:#C97B63; --ink:#1F2024; --ink-2:#2E2D28;
    --muted:#7A7160; --border:#E6E0D3; --surface:#FFFFFF;
    --ff-serif:'Fraunces','Iowan Old Style',Georgia,serif;
    --ff-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box;}
  html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;}
  body{margin:0;background:var(--cream);color:var(--ink);font-family:var(--ff-sans);
    font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;}
  a{color:var(--sage);text-underline-offset:3px;}
  a:hover{color:var(--sage-dark);}

  nav.top{position:sticky;top:0;z-index:50;background:rgba(250,247,242,0.88);
    backdrop-filter:saturate(140%) blur(12px);-webkit-backdrop-filter:saturate(140%) blur(12px);
    border-bottom:1px solid rgba(230,224,211,0.6);}
  nav.top .wrap{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;
    justify-content:space-between;align-items:center;}
  nav.top .logo{display:flex;align-items:center;gap:10px;font-family:var(--ff-serif);
    font-weight:500;font-size:19px;color:var(--ink);text-decoration:none;}
  nav.top .logo svg{width:26px;height:26px;}
  nav.top .links a{margin-left:24px;font-size:14px;color:var(--ink-2);
    font-weight:500;text-decoration:none;}
  nav.top .links a:hover{color:var(--sage);}

  .container{max-width:740px;margin:0 auto;padding:48px 24px 80px;}

  /* Intro screen */
  #intro{text-align:center;}
  .kicker{font-size:12px;letter-spacing:0.14em;text-transform:uppercase;
    font-weight:700;color:var(--sage);margin-bottom:14px;}
  h1{font-family:var(--ff-serif);font-size:clamp(34px,5vw,52px);
    line-height:1.1;margin:0 0 16px;font-weight:500;letter-spacing:-0.018em;
    font-variation-settings:"opsz" 96,"wght" 500;}
  #intro .sub{margin:0 auto 32px;max-width:580px;color:var(--ink-2);font-size:18px;line-height:1.55;}
  #intro ul{text-align:left;max-width:480px;margin:0 auto 36px;padding-left:22px;color:var(--ink-2);}
  #intro li{margin:8px 0;}
  .btn-primary{display:inline-block;padding:14px 34px;background:var(--sage);
    color:var(--cream);text-decoration:none;border-radius:999px;font-weight:600;
    font-size:16px;border:none;cursor:pointer;font-family:inherit;
    transition:background .14s ease;}
  .btn-primary:hover{background:var(--sage-dark);color:var(--cream);}

  /* Quiz screen */
  .progress-wrap{margin-bottom:30px;}
  .progress-meta{display:flex;justify-content:space-between;font-size:13px;
    color:var(--muted);margin-bottom:8px;letter-spacing:0.04em;
    text-transform:uppercase;font-weight:600;}
  .progress-bar{height:6px;background:var(--cream-2);border-radius:999px;overflow:hidden;}
  .progress-fill{height:100%;background:var(--sage);width:0%;border-radius:999px;
    transition:width .25s ease;}

  .q-text{font-family:var(--ff-serif);font-size:24px;line-height:1.3;
    font-weight:500;margin:0 0 24px;font-variation-settings:"opsz" 48,"wght" 500;}

  .options{display:flex;flex-direction:column;gap:10px;}
  .opt{display:block;padding:16px 20px;background:var(--surface);border:1px solid var(--border);
    border-radius:12px;cursor:pointer;color:var(--ink-2);font-size:15.5px;line-height:1.45;
    transition:border-color .12s ease, background .12s ease, transform .12s ease;}
  .opt:hover{border-color:var(--sage-soft);background:var(--cream-2);}
  .opt.selected{border-color:var(--sage);background:var(--sage-soft);color:var(--ink);}

  .nav-row{display:flex;justify-content:space-between;align-items:center;margin-top:28px;}
  .btn-secondary{padding:11px 22px;background:transparent;color:var(--sage);
    border:1px solid var(--border);border-radius:999px;cursor:pointer;
    font-family:inherit;font-size:14px;font-weight:600;}
  .btn-secondary:hover{background:var(--cream-2);}
  .btn-secondary:disabled{opacity:0.4;cursor:not-allowed;}

  /* Result screen */
  #result{display:none;}
  .result-emoji{font-size:64px;text-align:center;margin-bottom:8px;line-height:1;}
  .result-tagline{text-align:center;font-style:italic;color:var(--muted);margin:0 0 24px;}
  .result-card{padding:28px 26px;background:var(--surface);border:1px solid var(--border);
    border-radius:18px;margin-bottom:24px;}
  .result-card h3{font-family:var(--ff-serif);font-size:20px;margin:0 0 10px;color:var(--sage-dark);
    font-variation-settings:"opsz" 32,"wght" 500;}
  .result-card p{margin:0 0 14px;color:var(--ink-2);}
  .result-card p:last-child{margin-bottom:0;}

  .trait-row{display:flex;align-items:center;gap:12px;margin:8px 0;}
  .trait-label{flex:0 0 130px;font-size:13.5px;color:var(--ink-2);font-weight:600;}
  .trait-bar-wrap{flex:1;height:8px;background:var(--cream-2);border-radius:999px;overflow:hidden;}
  .trait-bar{height:100%;background:var(--sage);border-radius:999px;
    transition:width .8s cubic-bezier(.2,.7,.2,1);}
  .trait-pct{flex:0 0 44px;font-size:12.5px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums;}

  .share-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:18px 0 0;}
  .share-row button{padding:10px 18px;background:var(--cream-2);color:var(--ink);
    border:1px solid var(--border);border-radius:999px;cursor:pointer;
    font-family:inherit;font-size:13.5px;font-weight:600;}
  .share-row button:hover{border-color:var(--sage-soft);}

  .app-cta{margin:40px 0 0;padding:32px 28px;background:var(--sage-dark);
    color:var(--cream);border-radius:18px;text-align:center;}
  .app-cta h3{font-family:var(--ff-serif);font-size:24px;margin:0 0 8px;color:var(--cream);
    font-variation-settings:"opsz" 48,"wght" 500;}
  .app-cta p{margin:0 auto 20px;max-width:520px;color:rgba(250,247,242,0.86);font-size:15px;line-height:1.55;}
  .app-cta a{display:inline-block;padding:12px 24px;background:var(--cream);
    color:var(--sage-dark);text-decoration:none;border-radius:999px;
    font-weight:600;font-size:15px;}
  .app-cta a:hover{background:#fff;}

  .restart{text-align:center;margin-top:20px;}
  .restart button{background:none;border:none;color:var(--muted);text-decoration:underline;
    cursor:pointer;font-family:inherit;font-size:14px;}
  .restart button:hover{color:var(--sage);}

  .footnote{margin:48px 0 0;padding:20px;background:var(--cream-2);border-radius:12px;
    font-size:13px;color:var(--muted);line-height:1.6;}
  .footnote a{color:var(--sage);}

  .related-reading{margin-top:48px;padding-top:36px;border-top:1px solid var(--border);}
  .related-reading h2{font-family:var(--ff-serif);font-size:26px;margin:0 0 8px;
    font-weight:500;font-variation-settings:"opsz" 48,"wght" 500;}
  .related-blurb{margin:0 0 24px;color:var(--ink-2);max-width:640px;}
  .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
  .related-card{display:flex;flex-direction:column;gap:6px;padding:18px 20px 20px;
    background:var(--surface);border:1px solid var(--border);border-radius:14px;
    text-decoration:none;color:var(--ink);
    transition:transform .14s ease, box-shadow .14s ease, border-color .14s ease;}
  .related-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(31,32,36,.06);
    border-color:var(--sage-soft);}
  .related-tag{font-size:11px;letter-spacing:0.08em;text-transform:uppercase;
    font-weight:700;color:var(--sage);}
  .related-title{font-family:var(--ff-serif);font-size:17px;font-weight:500;
    line-height:1.3;color:var(--ink);font-variation-settings:"opsz" 32,"wght" 500;}
  .related-hint{font-size:14px;color:var(--ink-2);line-height:1.5;}
  .related-foot{margin:22px 0 0;font-size:14.5px;}

  footer.site-foot{margin-top:60px;padding:32px 24px;border-top:1px solid var(--border);
    color:var(--muted);font-size:13px;text-align:center;}
  footer.site-foot a{color:var(--muted);margin:0 8px;text-decoration:none;}
  footer.site-foot a:hover{color:var(--sage);}
</style>
</head>
<body>
<nav class="top">
  <div class="wrap">
    <a class="logo" href="/">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="32" cy="34" r="20" fill="#3F6456"/>
        <path d="M16 22 L20 10 L26 24 Z" fill="#3F6456"/>
        <path d="M48 22 L44 10 L38 24 Z" fill="#3F6456"/>
        <circle cx="26" cy="32" r="2.4" fill="#FAF7F2"/>
        <circle cx="38" cy="32" r="2.4" fill="#FAF7F2"/>
      </svg>
      CatMD
    </a>
    <div class="links">
      <a href="/library">Library</a>
      <a href="/cat-symptom-checker">Symptom Checker</a>
      <a href="/blog">Blog</a>
    </div>
  </div>
</nav>

<main class="container">
  <section id="intro">
    <div class="kicker">Free · 10 Questions · 2 Minutes</div>
    <h1>Cat Personality Test</h1>
    <p class="sub">Discover your cat's personality archetype using the <strong>Feline Five</strong> — the research framework feline behaviourists use to describe cat personality.</p>
    <ul>
      <li>10 questions about how your cat actually behaves</li>
      <li>Scores against 5 traits: skittishness, outgoingness, dominance, spontaneity, friendliness</li>
      <li>Matches her to one of 9 archetypes with lifestyle implications</li>
      <li>No signup, no email, no data collection</li>
    </ul>
    <button class="btn-primary" id="startBtn">Start the test</button>
  </section>

  <section id="quiz" style="display:none;">
    <div class="progress-wrap">
      <div class="progress-meta">
        <span id="qNum">Question 1 of ${QUESTIONS.length}</span>
        <span id="qPct">10%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
    </div>
    <p class="q-text" id="qText"></p>
    <div class="options" id="optionsList"></div>
    <div class="nav-row">
      <button class="btn-secondary" id="backBtn" disabled>← Back</button>
      <button class="btn-primary" id="nextBtn" disabled>Next →</button>
    </div>
  </section>

  <section id="result">
    <div class="kicker" style="text-align:center;">Your cat's archetype</div>
    <div class="result-emoji" id="resEmoji"></div>
    <h1 id="resName" style="text-align:center;"></h1>
    <p class="result-tagline" id="resTagline"></p>

    <div class="result-card">
      <h3>The pattern</h3>
      <p id="resDesc"></p>
      <h3 style="margin-top:18px;">What this means for daily life</h3>
      <p id="resLifestyle"></p>
    </div>

    <div class="result-card">
      <h3>Her trait scores</h3>
      <div id="traitBars"></div>
    </div>

    <div class="share-row">
      <button id="shareBtn">Share</button>
      <button id="copyBtn">Copy link</button>
    </div>

    <div class="app-cta">
      <h3>See her personality come to life every day</h3>
      <p>CatMD remembers her archetype and writes her daily diary, chat replies, and postcards in her actual personality voice. Free on Google Play.</p>
      <a href="${playUrl}" rel="nofollow">Get CatMD on Google Play</a>
    </div>

    <div class="restart"><button id="restartBtn">Retake the test</button></div>

    <div class="footnote">
      Based on the <strong>Feline Five</strong> framework (Litchfield et al., <em>PLoS ONE</em>, 2017) — a five-trait personality model derived from a survey of over 2,800 cat owners. Read the full deep-dive: <a href="/library/feline-five-personality-framework">The Feline Five — the science of cat personality</a>.
    </div>

    <section class="related-reading">
      <h2>More from the CatMD Library</h2>
      <p class="related-blurb">Next reads if you want to go deeper on personality, bonding, behaviour, and welfare.</p>
      <div class="related-grid">
        <a href="/library/feline-five-personality-framework" class="related-card">
          <span class="related-tag">Personality</span>
          <span class="related-title">The Feline Five — The Science of Cat Personality</span>
          <span class="related-hint">The research-validated framework behind this quiz, with all 9 archetypes explored in depth.</span>
        </a>
        <a href="/library/how-to-bond-with-cat" class="related-card">
          <span class="related-tag">Bonding</span>
          <span class="related-title">How to Bond With Your Cat (Properly)</span>
          <span class="related-hint">The trust-building rituals that work — and the well-meaning ones that break trust.</span>
        </a>
        <a href="/library/five-pillars-happy-indoor-cat" class="related-card">
          <span class="related-tag">Welfare</span>
          <span class="related-title">The 5 Pillars of a Happy Indoor Cat</span>
          <span class="related-hint">The AAFP/ISFM welfare standard, with a 15-minute home audit.</span>
        </a>
        <a href="/library/cat-body-language-ears-whiskers-eyes" class="related-card">
          <span class="related-tag">Body language</span>
          <span class="related-title">Cat Body Language Meaning</span>
          <span class="related-hint">What ears, eyes, whiskers, tail, and posture each tell you about her mood.</span>
        </a>
        <a href="/library/multi-cat-household-harmony" class="related-card">
          <span class="related-tag">Multi-cat</span>
          <span class="related-title">Multi-Cat Household Harmony</span>
          <span class="related-hint">Match cats on activity level and dominance — the personality combinations that work.</span>
        </a>
        <a href="/cat-symptom-checker" class="related-card">
          <span class="related-tag">Tool</span>
          <span class="related-title">Cat Symptom Checker</span>
          <span class="related-hint">Pick a symptom, get the right vet-reviewed guide. Free.</span>
        </a>
      </div>
      <p class="related-foot"><a href="/library">Browse the full CatMD Library →</a></p>
    </section>
  </section>
</main>

<footer class="site-foot">
  <div>
    <a href="/library">Library</a> ·
    <a href="/blog">Blog</a> ·
    <a href="/cat-symptom-checker">Symptom Checker</a> ·
    <a href="/privacy">Privacy</a> ·
    <a href="/terms">Terms</a> ·
    <a href="/disclaimer">Disclaimer</a>
  </div>
  <div style="margin-top:10px;">© ${new Date().getFullYear()} CatMD · catmd.pet</div>
</footer>

<script id="quizData" type="application/json">${quizData}</script>
<script>
(function(){
  var DATA = JSON.parse(document.getElementById('quizData').textContent);
  var QUESTIONS = DATA.questions;
  var ARCHETYPES = DATA.archetypes;

  var introEl = document.getElementById('intro');
  var quizEl = document.getElementById('quiz');
  var resultEl = document.getElementById('result');
  var qNumEl = document.getElementById('qNum');
  var qPctEl = document.getElementById('qPct');
  var qTextEl = document.getElementById('qText');
  var optsEl = document.getElementById('optionsList');
  var progressEl = document.getElementById('progressFill');
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');

  var current = 0;
  var answers = new Array(QUESTIONS.length).fill(null);

  function renderQuestion(){
    var q = QUESTIONS[current];
    qNumEl.textContent = 'Question ' + (current+1) + ' of ' + QUESTIONS.length;
    var pct = Math.round(((current+1) / QUESTIONS.length) * 100);
    qPctEl.textContent = pct + '%';
    progressEl.style.width = pct + '%';
    qTextEl.textContent = q.text;
    optsEl.innerHTML = '';
    q.options.forEach(function(opt, i){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (answers[current] === i ? ' selected' : '');
      b.textContent = opt;
      b.onclick = function(){ selectOption(i); };
      optsEl.appendChild(b);
    });
    backBtn.disabled = current === 0;
    nextBtn.disabled = answers[current] === null;
    nextBtn.textContent = current === QUESTIONS.length - 1 ? 'See result →' : 'Next →';
  }

  function selectOption(i){
    answers[current] = i;
    renderQuestion();
  }

  backBtn.onclick = function(){
    if (current > 0) { current--; renderQuestion(); }
  };

  nextBtn.onclick = function(){
    if (answers[current] === null) return;
    if (current < QUESTIONS.length - 1) { current++; renderQuestion(); }
    else { showResult(); }
  };

  document.getElementById('startBtn').onclick = function(){
    introEl.style.display = 'none';
    quizEl.style.display = 'block';
    current = 0;
    answers = new Array(QUESTIONS.length).fill(null);
    renderQuestion();
    window.scrollTo({top:0, behavior:'smooth'});
  };

  document.getElementById('restartBtn').onclick = function(){
    resultEl.style.display = 'none';
    introEl.style.display = 'block';
    window.scrollTo({top:0, behavior:'smooth'});
  };

  function computeTraits(){
    var sums = { skittishness:0, outgoingness:0, dominance:0, spontaneity:0, friendliness:0 };
    var counts = { skittishness:0, outgoingness:0, dominance:0, spontaneity:0, friendliness:0 };
    QUESTIONS.forEach(function(q, i){
      var ans = answers[i];
      if (ans === null) return;
      var raw = ans + 1; // 1-5 scale
      if (q.reverse) raw = 6 - raw;
      sums[q.trait] += raw;
      counts[q.trait]++;
    });
    var pct = {};
    Object.keys(sums).forEach(function(k){
      if (counts[k] === 0) { pct[k] = 50; return; }
      var avg = sums[k] / counts[k]; // 1-5
      pct[k] = Math.round(((avg - 1) / 4) * 100); // 0-100
    });
    return pct;
  }

  function findArchetype(traits){
    var best = null;
    var bestDist = Infinity;
    ARCHETYPES.forEach(function(a){
      var dx2 = 0;
      Object.keys(a.prototype).forEach(function(k){
        var d = a.prototype[k] - traits[k];
        dx2 += d*d;
      });
      if (dx2 < bestDist){ bestDist = dx2; best = a; }
    });
    return best;
  }

  function showResult(){
    var traits = computeTraits();
    var arch = findArchetype(traits);
    quizEl.style.display = 'none';
    resultEl.style.display = 'block';

    document.getElementById('resEmoji').textContent = arch.emoji;
    document.getElementById('resName').textContent = arch.name;
    document.getElementById('resTagline').textContent = arch.tagline;
    document.getElementById('resDesc').textContent = arch.description;
    document.getElementById('resLifestyle').textContent = arch.lifestyle;

    var tbWrap = document.getElementById('traitBars');
    tbWrap.innerHTML = '';
    var traitLabels = {
      skittishness:'Skittishness',
      outgoingness:'Outgoingness',
      dominance:'Dominance',
      spontaneity:'Spontaneity',
      friendliness:'Friendliness',
    };
    Object.keys(traitLabels).forEach(function(k){
      var row = document.createElement('div');
      row.className = 'trait-row';
      row.innerHTML =
        '<span class="trait-label">' + traitLabels[k] + '</span>' +
        '<span class="trait-bar-wrap"><span class="trait-bar" style="width:0%"></span></span>' +
        '<span class="trait-pct">' + traits[k] + '%</span>';
      tbWrap.appendChild(row);
    });
    // Animate bars after insertion.
    setTimeout(function(){
      var bars = tbWrap.querySelectorAll('.trait-bar');
      var keys = Object.keys(traitLabels);
      bars.forEach(function(bar, i){ bar.style.width = traits[keys[i]] + '%'; });
    }, 60);

    // Update URL hash so a refresh keeps the result and the share URL is meaningful.
    try { history.replaceState(null, '', '#' + arch.id); } catch(e){}

    // Track event if PostHog is loaded by renderAnalyticsScripts.
    try {
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture('cat_personality_test_completed', {
          archetype_id: arch.id,
          archetype_name: arch.name,
          skittishness: traits.skittishness,
          outgoingness: traits.outgoingness,
          dominance: traits.dominance,
          spontaneity: traits.spontaneity,
          friendliness: traits.friendliness,
        });
      }
    } catch(e){}

    window.scrollTo({top:0, behavior:'smooth'});
  }

  document.getElementById('shareBtn').onclick = function(){
    var title = document.getElementById('resName').textContent;
    var text = 'My cat is ' + title + ' — find your cat\\'s archetype on the CatMD personality test.';
    if (navigator.share) {
      navigator.share({ title:'Cat Personality Test', text:text, url:location.href });
    } else {
      navigator.clipboard.writeText(text + ' ' + location.href);
      alert('Link copied to clipboard.');
    }
  };

  document.getElementById('copyBtn').onclick = function(){
    navigator.clipboard.writeText(location.href);
    var b = document.getElementById('copyBtn');
    var orig = b.textContent;
    b.textContent = 'Copied!';
    setTimeout(function(){ b.textContent = orig; }, 1400);
  };
})();
</script>
</body>
</html>`;
}
