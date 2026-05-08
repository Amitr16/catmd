/**
 * Cat Studio — AI-generated cat art across multiple themes featuring
 * the user's actual cat.
 *
 * Concept: pick a variant ("Lord of the Meows", "Cleocatra", "Mona
 * Lily", etc.). The AI takes the user's cat photo and renders the cat
 * as the hero of that variant's visual style. Output: 1024×1536
 * vertical portrait (poster / painting / portrait aspect), share-ready.
 *
 * Themes (added 2026-05-03 expanding from v1 movie-posters-only):
 *   - Movie posters (8 variants) — Lord of the Meows, Catsby, etc.
 *   - Historical figures (3) — Cleocatra, Sir Isaac Mewton, Marie Antoincat
 *   - Famous paintings (3) — Mona Lily, Starry Mew, Cat with the Pearl Earring
 *   - Studio Ghibli scenes (2) — beyond the My-Neighbor-Mittens movie poster
 *   - Pixar characters (2) — The Incredible Cat, Up
 *   - 80s anime (2) — Akira-style, Sailor Cat
 *
 * Why curated variants > "describe whatever you want": creative writing
 * prompts are hard to author and most users won't write a good one.
 * Curated templates with locked-in visual styles produce reliably-
 * shareable results without the user needing to know prompt engineering.
 *
 * Cost: ~$0.04-0.10 per generation (gpt-image-1 medium quality).
 * Latency: 15-30s per image. UI shows a designer-flavored progress
 * indicator while waiting.
 */
import { generateImage } from '../ai/client';
import { track } from './analytics';
import type { CatProfile } from '../state/catStore';
import type { PhotoStudioPhoto } from './photoStudio';

// ---------------------------------------------------------------------------
// Genre definitions — name + creative direction prompt
// ---------------------------------------------------------------------------

/**
 * The visual format the AI should produce. Different themes need
 * different framing instructions appended to the styleDirection so
 * the output looks correct (a painting shouldn't have movie-poster
 * title typography, an anime cell shouldn't have a "starring [name]"
 * credit). Movie posters stay the default for the original 8 genres
 * to keep the existing prompts behaving identically.
 */
export type GenreFormat =
  | 'movie_poster'           // Vertical poster with title + co-star credit
  | 'historical_portrait'    // Renaissance / Baroque oil painting style
  | 'classical_painting'     // Specific famous-painting recreations
  | 'studio_ghibli'          // Watercolor anime scene, no poster framing
  | 'pixar_key_art'          // 3D-rendered Pixar key art
  | 'anime_cell';            // Hand-drawn 80s anime cell aesthetic

export type Genre = {
  id: string;
  /** Title that appears on the artwork (poster title, painting label, etc.). */
  title: string;
  /** Short tagline shown in the genre picker. */
  tagline: string;
  /** Emoji shown in the picker tile (visual marker). */
  emoji: string;
  /**
   * Top-level theme this variant belongs to — used to GROUP variants
   * in the picker UI ("Movie posters", "Historical figures", etc.).
   * Free-form string; the picker derives section headings from
   * unique values in the order they appear in GENRES.
   */
  theme: string;
  /**
   * Output format. Optional for backward compat; defaults to
   * 'movie_poster'. Drives the format-specific framing block in
   * `generatePoster`'s prompt builder.
   */
  format?: GenreFormat;
  /**
   * Style direction injected into the image prompt. Carefully written
   * to produce reliably-good output without requiring the user to know
   * prompt engineering. Each ends with cat-identity-preservation so
   * the input photo's cat is preserved as the focal subject.
   */
  styleDirection: string;
};

export const GENRES: Genre[] = [
  // ── THEME: Movie posters ─────────────────────────────────────────
  {
    id: 'lord_of_the_meows',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'Lord of the Meows',
    tagline: 'Epic fantasy. Cat as the chosen one.',
    emoji: '⚔️',
    styleDirection:
      'Epic fantasy movie poster in the style of Lord of the Rings or Game of Thrones. Dramatic chiaroscuro lighting, ornate gothic typography in burnished gold reading "Lord of the Meows", misty mountain silhouettes in the background, dramatic sky with shafts of golden light. Make this cat the hero, posed regally in the foreground in dramatic three-quarter view, eyes blazing with importance. Painterly, cinematic, museum-quality fantasy art.',
  },
  {
    id: 'catlas_shrugged',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'Catlas Shrugged',
    tagline: 'Industrial deco. Cat against the world.',
    emoji: '🏛️',
    styleDirection:
      'Mid-century industrial art-deco poster in sepia and copper tones. Bold serif typography reading "Catlas Shrugged" at the top. Skyscrapers and railroad tracks vanish into the background in dramatic perspective. Cat positioned heroically center-frame, lit from below, looking out into the distance. The aesthetic of 1940s modernist American posters — Norman Rockwell meets Ayn Rand book cover.',
  },
  {
    id: 'great_catsby',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'The Great Catsby',
    tagline: 'Roaring twenties. Glamour cat.',
    emoji: '🥂',
    styleDirection:
      'Art-deco poster in the style of 1920s Jazz Age cinema. Gatsby-era gold and emerald green palette, geometric sunburst patterns, elegant flapper-era typography reading "The Great Catsby". Cat in the foreground in a glamorous three-quarter pose, decorative geometric sunburst halo behind. Champagne flutes and pearls scattered as decorative elements. Old-money glamour.',
  },
  {
    id: 'silence_of_the_lambs',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'Silence of the Lamb-licks',
    tagline: 'Psychological thriller. Cat with secrets.',
    emoji: '🌑',
    styleDirection:
      'Dark psychological thriller poster in the style of Silence of the Lambs. Stark vertical composition, shadowy black background, single dramatic light source from below illuminating the cat\'s face. Bold sans-serif title typography reading "Silence of the Lamb-licks" in white. Mysterious, unsettling, eyes that follow you. The cat looks like it knows something you don\'t.',
  },
  {
    id: 'meowtrix',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'The Meowtrix',
    tagline: 'Cyberpunk action. Cat takes the red pill.',
    emoji: '💊',
    styleDirection:
      'Cyberpunk movie poster in the style of The Matrix. Cascading green digital code rain in the background, deep blacks and emerald greens, dramatic neon lighting. Bold tech-style typography reading "The Meowtrix". Cat in a heroic action pose, bullet-time-style ripples around the body, sleek leather-jacket aesthetic. The cat looks ready to bend reality.',
  },
  {
    id: 'top_gun_meowverick',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'Top Gun: Meowverick',
    tagline: 'High-octane aviation. Cat hits the deck.',
    emoji: '✈️',
    styleDirection:
      '80s blockbuster aviation movie poster in the style of Top Gun. Sun-bleached sky, fighter jet silhouettes streaking through clouds, golden-hour lighting, cocky aviator-shades aesthetic. Bold red+gold typography reading "Top Gun: Meowverick". Cat front-and-center wearing implied aviator confidence — windswept fur, looking out over a runway, jet trail behind. American flag colors as accents.',
  },
  {
    id: 'james_bond',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'A View to a Purr',
    tagline: 'Spy thriller. Cat is licensed to kill.',
    emoji: '🍸',
    styleDirection:
      'Classic James Bond movie poster aesthetic. Black and gold palette with crimson highlights, the iconic 007 gun-barrel silhouette frame around the composition. Bold serif typography reading "A View to a Purr". Cat in a sophisticated three-quarter pose, looking sideways with an aloof spy aesthetic. Crystal cocktail glass and silhouettes of casino skylines as decorative elements. Sean Connery-era poster styling.',
  },
  {
    id: 'my_neighbor_mittens',
    theme: 'Movie posters',
    format: 'movie_poster',
    title: 'My Neighbor Mittens',
    tagline: 'Ghibli movie poster. Cat as forest spirit.',
    emoji: '🌳',
    styleDirection:
      'Studio Ghibli movie poster in the style of My Neighbor Totoro or Spirited Away. Hand-painted watercolor aesthetic, soft greens and warm sunset tones, gentle dappled light through forest leaves. Hand-lettered Japanese-influenced typography reading "My Neighbor Mittens". Cat as a magical, oversized, soft-edged forest spirit with kind eyes, surrounded by tiny floating soot sprites and golden-hour fireflies. Whimsical, warm, a little melancholic.',
  },

  // ── THEME: Historical figures ────────────────────────────────────
  {
    id: 'cleocatra',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Cleocatra',
    tagline: 'The last pharaoh. Eyeliner game unmatched.',
    emoji: '👑',
    styleDirection:
      'Regal Ptolemaic-era Egyptian portrait recasting the cat as Cleopatra. Gold leaf headdress with cobra (uraeus) emblem, kohl-lined eyes, ornate Egyptian collar with lapis lazuli and turquoise scarabs. Background: hieroglyphics carved into sandstone, golden light from a sunset over the Nile. The cat sits enthroned in profile-three-quarter view, dignified, all-knowing. Painterly oil-painting style with the formal grandeur of an Old Master royal portrait.',
  },
  {
    id: 'sir_isaac_mewton',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Sir Isaac Mewton',
    tagline: 'Discovered the third law of cattitude.',
    emoji: '🍎',
    styleDirection:
      '17th-century scholarly portrait recasting the cat as Sir Isaac Newton. Cat wearing a long flowing white wig (powdered curls), a deep crimson robe with gold trim, holding a small open book of equations. Background: an oak-panelled study with leather-bound books, an apple on a desk, a brass telescope and prism nearby. Dramatic chiaroscuro lighting in the style of Godfrey Kneller\'s 1689 portrait of Newton. Painted oil-on-canvas aesthetic.',
  },
  {
    id: 'marie_antoincat',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Marie Antoincat',
    tagline: 'Let them eat treats.',
    emoji: '🍰',
    styleDirection:
      'Late-18th-century Versailles court portrait recasting the cat as Marie Antoinette. Towering powdered wig adorned with pearls, ribbons, miniature pastries, and a single sailing ship. Pale blue silk gown with lace trim, pink rosettes. Background: a gilded rococo salon with painted ceilings. Cat in a regal seated pose, slight smirk. Painted in the style of Élisabeth Vigée Le Brun — soft pastel palette, fine brushwork, French-rococo opulence.',
  },
  {
    id: 'napurrleon',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Napurrleon',
    tagline: 'Hand in waistcoat. Stares across Europe.',
    emoji: '🎖️',
    styleDirection:
      'Early-19th-century neoclassical portrait recasting the cat as Napoleon Bonaparte, in the style of Jacques-Louis David\'s "Napoleon Crossing the Alps". Cat in a flowing gold-trimmed crimson cape, bicorne hat with cockade, one paw tucked into a navy military waistcoat. Background: alpine cliffs at dramatic sunset, rearing white horse silhouette. Heroic three-quarter view. Oil-on-canvas finish with David\'s signature dramatic lighting and crisp neoclassical brushwork.',
  },
  {
    id: 'catarine_the_great',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Catarine the Great',
    tagline: 'Empress of all the cushions.',
    emoji: '👸',
    styleDirection:
      'Late-18th-century Russian imperial portrait recasting the cat as Catherine the Great. Cat seated regally on an ornate throne, draped in heavy ermine-trimmed crimson velvet robes, gold imperial orb and sceptre nearby, gleaming pearl-studded crown. Background: palatial chambers with gilded baroque mouldings, candelabras, snowy St Petersburg view through a window. Painted in the style of Fyodor Rokotov — formal, opulent, dignified.',
  },
  {
    id: 'albert_felinestein',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Albert Felinestein',
    tagline: 'Theory of relative naps.',
    emoji: '🧠',
    styleDirection:
      'Mid-20th-century scientist portrait recasting the cat as Albert Einstein. Wild, tousled silvery fur (mimicking the iconic hair), drooping moustache effect achieved through long whiskers, kind crinkled eyes. Wearing a tweed jacket, knit sweater visible underneath. Background: a chalkboard covered in equations (E=mc² visible), warm sepia photographic tones, slightly grainy 1940s portrait-photograph aesthetic. Painted in the style of a colorised vintage photograph.',
  },
  {
    id: 'frida_kittylo',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Frida Kittylo',
    tagline: 'Self-portrait. Painted with claw.',
    emoji: '🌺',
    styleDirection:
      'Self-portrait in the style of Frida Kahlo recasting the cat as Frida. Cat in a vivid embroidered traditional Mexican blouse, flower crown of marigolds, hibiscus, and bougainvillea atop the head, ornate gold jewellery. Bold connecting eyebrow effect from facial markings. Background: lush jungle foliage in deep emerald and ruby, monkeys and parrots peeking through. Painted in Kahlo\'s direct frontal-gaze style with thick visible brushwork and vivid Mexican-folk-art palette.',
  },
  {
    id: 'henry_eighth_lives',
    theme: 'Historical figures',
    format: 'historical_portrait',
    title: 'Henry VIII the Eighth-Lives',
    tagline: 'King of the cushion. Outlived six wives. And mice.',
    emoji: '👑',
    styleDirection:
      'Tudor royal portrait in the style of Hans Holbein the Younger\'s 1537 portrait of Henry VIII. Cat in a heavily padded crimson-and-gold doublet with puffed sleeves, jewelled chain of office, plumed black velvet cap. Wide-set stance (in seated form), broad imposing posture. Background: rich green damask with gold heraldic patterning. Strong frontal gaze, regal authority. Egg-tempera and oil aesthetic, highly detailed fur and fabric textures.',
  },

  // ── THEME: Famous paintings ──────────────────────────────────────
  {
    id: 'mona_lily',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'Mona Lily',
    tagline: 'The smile is enigmatic. The cat is judging you.',
    emoji: '🖼️',
    styleDirection:
      'Recreation of Leonardo da Vinci\'s Mona Lisa with the cat as the subject. Cat seated in three-quarter view, hands folded gracefully (paws crossed), faint enigmatic smile. Italian renaissance landscape behind: distant mountains, winding river, hazy atmospheric perspective (sfumato). The cat\'s eyes follow the viewer. Aged oil-paint surface with fine craquelure, warm sienna-and-amber palette, museum-frame implied. Title text NOT on canvas — paint as if hanging in the Louvre.',
  },
  {
    id: 'starry_mew',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'Starry Mew',
    tagline: 'Van Gogh after dinner. Cat sees the universe.',
    emoji: '🌌',
    styleDirection:
      'Recreation of Van Gogh\'s The Starry Night with the cat in the foreground. Swirling cobalt-and-cream night sky with thick impasto brushwork, the iconic spiral galaxy moon, glowing yellow stars, dark cypress tree on the left. Sleeping village beneath. Cat sits silhouetted on a hill in the foreground, gazing up at the stars, painted in Van Gogh\'s thick visible brushstrokes. Post-impressionist palette: cobalt, cream, ochre, viridian. Title text NOT on canvas — paint as a museum-hung Van Gogh.',
  },
  {
    id: 'cat_with_pearl_earring',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'Cat with the Pearl Earring',
    tagline: 'Vermeer. The over-the-shoulder glance.',
    emoji: '💎',
    styleDirection:
      'Recreation of Vermeer\'s Girl with a Pearl Earring with the cat as the subject. Cat looking back over the shoulder in three-quarter profile, soft direct gaze toward the viewer. Wearing a blue-and-yellow turban (head-wrap) and a single pearl earring catching light. Plain dark background. Soft directional north-window light, Vermeer\'s signature luminism. Painted oil-on-canvas, Dutch Golden Age aesthetic, fine brushwork on fur and fabric. Museum-hung framing implied.',
  },
  {
    id: 'the_scream_cat',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'The Scream Cat',
    tagline: 'Munch. The cat saw the vacuum cleaner.',
    emoji: '😱',
    styleDirection:
      'Recreation of Edvard Munch\'s The Scream with the cat as the screaming figure on the bridge. Cat with paws raised to face in iconic open-mouthed scream pose. Background: undulating swirling sky in Munch\'s signature blood-orange, yellow, and ultramarine, distorted fjord landscape, two distant figures on the bridge. Anxious expressionist palette and brushwork — visible swirling oil and pastel strokes. Cat\'s eyes preserved exactly. Museum-hung Munch reproduction.',
  },
  {
    id: 'american_cat_thic',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'American Cat-thic',
    tagline: 'Grant Wood. Stoic farm cat. Pitchfork energy.',
    emoji: '🌾',
    styleDirection:
      'Recreation of Grant Wood\'s American Gothic with the cat as the farmer figure. Cat in stiff, sober frontal pose holding a small pitchfork upright. Wearing wire-rimmed glasses, plain black overalls, white-collared shirt. Wooden white-clapboard farmhouse with the iconic pointed Gothic-Revival window directly behind. Stern, dignified, slightly comic. Painted in Wood\'s precisely-rendered American Regionalist style, restrained earth-tone palette.',
  },
  {
    id: 'persistence_of_mewmory',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'The Persistence of Mewmory',
    tagline: 'Dalí. Time melts. So does the cat.',
    emoji: '⏰',
    styleDirection:
      'Recreation of Salvador Dalí\'s The Persistence of Memory with the cat in the central position of the soft-shape "self-portrait" figure. Cat lounging on the cliff-shore landscape with melting pocket-watches draped over its body and the surrounding rocks. Background: stark Catalan coastline, distant blue cliffs, surrealist flat plane. Sharp Dalíesque hyper-realism with surrealist warping, deep cobalt-and-ochre palette, dreamlike clarity.',
  },
  {
    id: 'whiskers_mother',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'Whisker\'s Mother',
    tagline: 'Whistler. The dignified profile pose.',
    emoji: '🪑',
    styleDirection:
      'Recreation of James McNeill Whistler\'s "Arrangement in Grey and Black No. 1" (Whistler\'s Mother) with the cat in the seated profile pose. Cat seated upright in profile on a dark wooden chair, wearing a small white lace bonnet and a black shawl draped over the shoulders. Background: muted grey wall with a thin gold-framed picture and faint patterned curtain. Severely restrained palette — greys, blacks, ivory. Quiet dignity, Whistlerian tonalism.',
  },
  {
    id: 'birth_of_felis',
    theme: 'Famous paintings',
    format: 'classical_painting',
    title: 'The Birth of Felis',
    tagline: 'Botticelli. Cat emerges from the clamshell.',
    emoji: '🐚',
    styleDirection:
      'Recreation of Botticelli\'s The Birth of Venus with the cat as Venus in the centre. Cat standing upright on a giant scallop shell, draped in flowing strands of long fur and trailing rose petals. Soft warm Mediterranean light, pale sea-foam aquamarine waves. To the left: a wind-blowing zephyr couple; to the right: an attendant with flowing robes. Italian Renaissance tempera-on-canvas aesthetic, Botticelli\'s elegant elongated forms, decorative scattered flowers.',
  },

  // ── THEME: Studio Ghibli scenes ──────────────────────────────────
  {
    id: 'spirited_cat',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Spirited Cat',
    tagline: 'The bathhouse. Cat at the threshold.',
    emoji: '🏯',
    styleDirection:
      'Studio Ghibli scene in the style of Spirited Away by Hayao Miyazaki. Cat standing at the entrance of the magical bathhouse at dusk, wearing a small kimono-style wrap. Lanterns glowing red and gold above, soft watercolor wash, spirit-creatures milling in the background. Hand-painted watercolor with visible paper texture. Warm magic-hour palette: persimmon, indigo, soft cream. Cat\'s fur preserved exactly; rendered in Ghibli\'s gentle cel-shaded style. NO title text on the artwork.',
  },
  {
    id: 'howls_moving_cattle',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Howl\'s Moving Cattle',
    tagline: 'A wandering castle, with whiskers.',
    emoji: '🏰',
    styleDirection:
      'Studio Ghibli scene in the style of Howl\'s Moving Castle. Cat seated atop a fantastical mechanical castle of mismatched parts (chimneys, balconies, rotating gears), striding across a windswept Alpine meadow. Sky filled with wispy clouds; flock of birds in the distance. Watercolor-and-ink Ghibli aesthetic, soft pastel palette, Joe-Hisaishi-music vibes. Hand-painted texture. Whimsical, slightly melancholic. NO title text on the artwork.',
  },
  {
    id: 'princess_mewnonoke',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Princess Mewnonoke',
    tagline: 'Forest spirit. Riding the giant wolf.',
    emoji: '🌲',
    styleDirection:
      'Studio Ghibli scene in the style of Princess Mononoke. Cat as the brave forest-spirit guardian, riding peacefully atop a giant white wolf-companion through an ancient cedar forest. Cat wears small painted face markings in red, a tiny bone-shape necklace pendant. Background: shafts of green light through ancient mossy forest, friendly Kodama tree-spirits glowing softly in the distance. Hand-painted Ghibli watercolor aesthetic, deep forest palette, mystical and peaceful atmosphere.',
  },
  {
    id: 'kikis_catlivery',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Kiki\'s Catlivery Service',
    tagline: 'Witch-cat in flight. Coastal town below.',
    emoji: '🧹',
    styleDirection:
      'Studio Ghibli scene in the style of Kiki\'s Delivery Service. Cat in a small red ribbon, clutching a flying broomstick mid-air over a charming European coastal town with red-tile rooftops. Soft afternoon light, gentle wind streaming through fur. Brown delivery-bag tied to the broom. Hand-painted Ghibli watercolor aesthetic, warm coastal palette of rust-orange and sea-blue, Mediterranean storybook charm.',
  },
  {
    id: 'caticaa_valley_wind',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Cat-icaa of the Valley',
    tagline: 'Glider-cat. Saving the toxic forest.',
    emoji: '🪂',
    styleDirection:
      'Studio Ghibli scene in the style of Nausicaä of the Valley of the Wind. Cat in a blue tunic and brown leather flight-cap, clutching a small white glider mid-flight over a vast pastel-toned valley. Wind-streaked clouds, distant pastel windmills, hint of mystical fungal forest in the background. Hand-painted Ghibli watercolor aesthetic, pre-Ghibli classic Miyazaki linework, soft cyan-and-gold palette, sense of windswept hopeful adventure.',
  },
  {
    id: 'ponyo_cliff',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Ponyo, on the Cliff',
    tagline: 'Half-fish, half-cat. All adorable.',
    emoji: '🌊',
    styleDirection:
      'Studio Ghibli scene in the style of Ponyo. Cat with playful underwater-creature features (preserve cat\'s actual look but with a small fishlike-fin tail and tiny webbed paws), perched joyfully on a cliffside above crashing turquoise ocean waves. Bright wide eyes, mouth open in delight. Background: stylised cartoon waves with friendly fish faces in the surf, sunny coastal atmosphere. Bright primary-colour Ghibli palette, hand-painted with crayon-textured waves.',
  },
  {
    id: 'cat_bus_stop',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Cat Bus Stop',
    tagline: 'Rainy night. Soft umbrella. Spirit waiting.',
    emoji: '☔',
    styleDirection:
      'Studio Ghibli scene in the style of My Neighbor Totoro\'s iconic "bus stop in the rain" scene. Cat standing under a small yellow umbrella at a wooden bus stop in heavy summer rain, calm and patient. Soft glow of streetlight reflecting off wet ground. Background: dense bamboo forest at twilight in deep teal and indigo. A glowing acorn nearby on the ground. Hand-painted Ghibli watercolor aesthetic, warm-cool contrast, rain-streaked atmospheric depth.',
  },
  {
    id: 'cat_in_cat_sky',
    theme: 'Studio Ghibli scenes',
    format: 'studio_ghibli',
    title: 'Cat in the Sky',
    tagline: 'Floating island. Cat above the clouds.',
    emoji: '🏝️',
    styleDirection:
      'Studio Ghibli scene in the style of Castle in the Sky / Laputa. Cat standing atop the moss-covered ruins of an ancient floating island, wind ruffling fur, gold "levitation crystal" pendant glowing softly around the neck. Background: vast cloud-sea below, ribbon of sky above, ancient stone robot half-overgrown with vines in the distance. Hand-painted Ghibli watercolor aesthetic, sweeping vista, sense of awe.',
  },

  // ── THEME: Pixar characters ──────────────────────────────────────
  {
    id: 'incredible_cat',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'The Incredible Cat',
    tagline: 'Saving the world before treat time.',
    emoji: '🦸',
    styleDirection:
      'Pixar key art in the style of The Incredibles. Cat as a superhero in a sleek red-and-black costume with a yellow domino mask, dynamic action pose with cape flowing. 3D-rendered Pixar character art — soft volumetric lighting, expressive eyes, hyper-realistic fur with stylized exaggeration, cinematic depth of field. Background: stylized retro-futurist cityscape skyline at dusk with action lines suggesting a leap. Confident, heroic, slightly cocky.',
  },
  {
    id: 'up_balloon_cat',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Up, Up and Mew-way',
    tagline: 'House. Balloons. One excellent cat.',
    emoji: '🎈',
    styleDirection:
      'Pixar key art in the style of Up. Cat seated on the front porch of a quaint pastel-coloured wooden house being lifted by a massive bouquet of vibrant rainbow balloons. Soft cumulus clouds and a pastel sunrise sky behind. 3D-rendered Pixar aesthetic — soft volumetric lighting, painterly stylization, warm color script. Cat looks contented and slightly amazed. Whimsical, hopeful, family-friendly.',
  },
  {
    id: 'buzz_litterclear',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Buzz Litterclear',
    tagline: 'To infinity, and the litter box.',
    emoji: '🚀',
    styleDirection:
      'Pixar key art in the style of Toy Story / Buzz Lightyear. Cat in a sleek white-and-green-and-purple space-ranger spacesuit, helmet visor flipped up, retractable wings extended. Dynamic heroic pose with one paw outstretched. Background: 90s child\'s bedroom transformed into adventure scene — wallpaper of clouds, scattered toys reframed at toy-perspective scale. 3D-rendered Pixar aesthetic with the original Toy Story\'s warm soft lighting and painterly stylization.',
  },
  {
    id: 'ratacatouille',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Ratacatouille',
    tagline: 'Fine dining. Whisker-thin presentation.',
    emoji: '👨‍🍳',
    styleDirection:
      'Pixar key art in the style of Ratatouille. Cat in a small white chef\'s toque (hat) and tiny chef\'s apron, perched on the rim of a copper sauté pan, holding a sprig of thyme between paws. Background: Parisian rooftop bistro at night, glowing yellow windows, Eiffel Tower silhouette in the distance, warm copper-and-cream colour palette. 3D-rendered Pixar aesthetic, painterly stylization, charming gourmet atmosphere.',
  },
  {
    id: 'wall_cat',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Wall-Cat',
    tagline: 'Last cat on Earth. Loves a tidy planet.',
    emoji: '🤖',
    styleDirection:
      'Pixar key art in the style of WALL-E. Cat with sympathetic mechanical-toy elements — small treads under the body, a tiny robotic claw-arm, glowing yellow optical-camera eyes preserving the cat\'s actual eye color. Holding a single small green seedling in a battered boot. Background: dusty-orange post-apocalyptic Earth landscape with cubes of compacted trash stacked into towers behind, soft golden-hour lighting. 3D-rendered Pixar aesthetic, painterly stylization, melancholy hope.',
  },
  {
    id: 'finding_felix',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Finding Felix',
    tagline: 'Lost in the reef. Found in the heart.',
    emoji: '🐟',
    styleDirection:
      'Pixar key art in the style of Finding Nemo. Cat as a stylized "underwater explorer" with subtle fin-like ear extensions and tiny bubbles trailing through the fur, floating gracefully through a vibrant tropical coral reef. Background: glowing coral in lavender, tangerine, and aqua, schools of small striped fish, dappled sunlight rays from above. 3D-rendered Pixar aesthetic, painterly underwater stylization, joyful and adventurous.',
  },
  {
    id: 'cat_co',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Cat-co',
    tagline: 'Day of the Dead. Cat remembers.',
    emoji: '💀',
    styleDirection:
      'Pixar key art in the style of Coco. Cat with delicate Día de los Muertos sugar-skull face markings (ornate floral patterns painted in white over the face), wearing a small embroidered Mexican poncho. Holding a small guitar in paws. Background: Land of the Dead\'s towering pastel skyline of stacked candle-lit buildings, marigold petals floating through the air, vivid cobalt and marigold-orange palette. 3D-rendered Pixar aesthetic, painterly stylization, warm and reverent.',
  },
  {
    id: 'inside_mew',
    theme: 'Pixar characters',
    format: 'pixar_key_art',
    title: 'Inside Mew',
    tagline: 'Five emotions. Five cats. One brain.',
    emoji: '💭',
    styleDirection:
      'Pixar key art in the style of Inside Out. Cat\'s head shown in cross-section revealing five tiny emotion-cats inside (joy, sadness, anger, fear, disgust) operating a colourful glowing console. Each emotion-cat tinted in its emotion\'s signature colour (yellow, blue, red, purple, green). Background: glowing memory-orb shelves stretching into the distance. 3D-rendered Pixar aesthetic, painterly stylization, conceptual and playful.',
  },

  // ── THEME: 80s anime ────────────────────────────────────────────
  {
    id: 'akira_cat',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Akiracat',
    tagline: 'Neo-Tokyo. The cat awakens.',
    emoji: '🏍️',
    styleDirection:
      'Hand-drawn 80s cyberpunk anime cell in the style of Akira (1988). Cat seated atop a chrome motorcycle on a glowing neon-lit Neo-Tokyo street at night, wearing a dramatic red leather-jacket-style scarf around the neck. Background: rain-slick streets reflecting hot-pink and electric-cyan signage, soaring futuristic skyscrapers with glowing windows, friendly distant traffic lights. Hand-painted anime cell aesthetic — visible cel-paint texture, bold ink linework, dramatic foreshortening. Late-80s Katsuhiro Otomo cinematic energy. Cat looks cool and confident, not menacing.',
  },
  {
    id: 'sailor_cat',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Sailor Cat',
    tagline: 'In the name of the moon, you will be petted.',
    emoji: '🌙',
    styleDirection:
      '90s magical-girl anime cell in the style of Sailor Moon. Cat in a heroic pose with sparkles, tiara, sailor-collar accents, large expressive shoujo-anime eyes (preserve the cat\'s actual eye color). Background: pastel pink + cyan starfield with crescent moon, ribbons and roses floating around. Hand-drawn anime cel aesthetic — clean ink outlines, flat cel shading, glittery highlights, late-Showa-era Japan production-cel texture. Playful, sparkly, instantly nostalgic.',
  },
  {
    id: 'dragon_cat_z',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Dragon Cat Z',
    tagline: 'Power level: over nine THOUSAND.',
    emoji: '⚡',
    styleDirection:
      'Late-80s shonen anime cell in the style of Dragon Ball Z. Cat with spiked, glowing-golden fur (Super Saiyan effect), surrounded by a brilliant golden energy aura. Action-line speed motifs radiating from the body, intense determined expression, eyes glowing with confidence. Background: rocky desert plain, dramatic dust clouds swirling, distant mountains under a bright golden sky. Hand-drawn 80s anime cell aesthetic — bold ink lines, dramatic foreshortening, action-cel paint texture. Akira Toriyama energy. Cat is heroic, never aggressive.',
  },
  {
    id: 'lupin_cat',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Lupin Cat III',
    tagline: 'Gentleman thief. The score: tuna.',
    emoji: '🎩',
    styleDirection:
      '80s anime cell in the style of Lupin III (1984 series). Cat in a sharp red sport coat, narrow black tie, and a tiny matching fedora at a jaunty angle. Sly grin, smug confident expression. Background: moonlit Italian rooftop with red-tile chimneys, vintage sports car silhouette, beam of police searchlight in the distance. Hand-drawn 80s anime cell aesthetic — angular linework, retro caper-comedy palette, Monkey-Punch elegance.',
  },
  {
    id: 'cats_eye',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Cat\'s Eye',
    tagline: 'The art-heist anime. Stealth-mode whiskers.',
    emoji: '🖤',
    styleDirection:
      '80s anime cell in the style of Cat\'s Eye (1983) by Tsukasa Hojo. Cat in a sleek black skin-tight cat-burglar outfit with a domino-mask, perched gracefully on a museum skylight ledge by night. City skyline of Tokyo glowing below. Stylish elegant pose. Hand-drawn 80s anime cell aesthetic — sharp graphic shadows, neon-night palette of magenta, cobalt and black, stylish heist-noir mood.',
  },
  {
    id: 'captain_catsubasa',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Captain Catsubasa',
    tagline: 'Soccer striker. Field of one. Net of dreams.',
    emoji: '⚽',
    styleDirection:
      '80s sports anime cell in the style of Captain Tsubasa (1983). Cat in a small Japanese soccer kit (red and white jersey, blue shorts), mid-air kicking pose with massive exaggerated dramatic motion lines, headband fluttering. Soccer ball blasting forward with golden energy lines. Background: stadium crowd in indistinct cheering masses, blue sky, tournament banners. Hand-drawn 80s anime cell aesthetic — heroic shonen-energy linework, exaggerated perspective.',
  },
  {
    id: 'voltcat',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Voltcat',
    tagline: 'Form feline-bot! Defender of the litter.',
    emoji: '🤖',
    styleDirection:
      '80s mech-anime cell in the style of Voltron / Mazinger / Robotech. Cat as the pilot of a giant blue-and-red robot mech that mirrors the cat\'s posture, both visible — cat in a cockpit-bubble at the chest, mech striking a heroic standing pose. Background: starfield with distant friendly spaceships, lens flares, glowing planet on the horizon. Hand-drawn 80s anime cell aesthetic — mecha hard-edge linework, primary-colour palette, retro sci-fi optimism. Bold heroic poses, dramatic foreshortening.',
  },
  {
    id: 'speed_cat_racer',
    theme: '80s anime',
    format: 'anime_cell',
    title: 'Speed Cat Racer',
    tagline: 'Mach 5. Whiskers in the wind.',
    emoji: '🏎️',
    styleDirection:
      '80s racing anime cell in the style of Speed Racer (popular in 80s reruns). Cat as the driver of the iconic white Mach 5 racecar with red "M" emblem, gripping steering wheel with paws, white racing helmet with small white scarf streaming behind. Background: winding mountain race-track at sunset, blue-orange sky, exaggerated speed-line streaks suggesting velocity. Hand-drawn 80s anime cell aesthetic — bold cel-paint, retro motorsport energy.',
  },
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type CatStudioPoster = {
  id: string;
  cat_id: string;
  genre_id: string;
  /** Base64 PNG of the generated poster. */
  image_b64: string;
  generated_at: string;
  /**
   * Set true when the poster was created by the Sunday-10am weekly auto
   * job (vs the user-driven "Pick a genre + Generate" flow). Used by the
   * landing screen to decide whether the current week has a fresh
   * auto-poster yet.
   */
  auto?: boolean;
};

/**
 * Generate a poster for the given cat in the given genre.
 *
 * The cat's profile photo (when set) is passed to the image API as a
 * reference so the generated poster preserves the cat's actual look —
 * coat colour, eye colour, build, breed cues. Without a photo, we
 * fall back to a generic "cat in genre" generation; the poster is
 * still on-brand for the genre but the cat will be a generic stand-in.
 *
 * Throws on AI errors. Caller should surface a friendly retry CTA.
 */
export async function generatePoster(opts: {
  cat: CatProfile;
  genre: Genre;
  catPhotoBase64?: string | null;
}): Promise<CatStudioPoster> {
  const { cat, genre, catPhotoBase64 } = opts;

  // Build the full prompt: style direction + cat-specific cues.
  // CRITICAL: when a reference photo is attached, the prompt must
  // emphasise FAITHFUL preservation of the cat's specific look. Without
  // this language gpt-image-1 tends to drift toward a generic cat in
  // the genre's style — user feedback explicitly: "this is cute but
  // this is not MY cat." The bolded identity-preservation block below
  // is the fix.
  const hasRef = !!catPhotoBase64;
  const format = genre.format ?? 'movie_poster';
  const promptLines: string[] = [
    genre.styleDirection,
    '',
  ];

  // Format-specific framing — different output types need different
  // text/typography/aspect rules so the AI doesn't, e.g., paint a
  // Vermeer recreation with a "starring Lily" co-star credit on the
  // canvas. Each branch also instructs the AI to include a small,
  // unobtrusive "catmd.pet" watermark in a corner — an attribution
  // mark that travels with shared posters back to the brand.
  if (format === 'movie_poster') {
    promptLines.push(
      `The cat's name is "${cat.name}". Optionally include the name as a small co-star credit on the poster (e.g. "starring ${cat.name}") in the appropriate typography style.`,
      'Vertical movie-poster aspect ratio. Make the cat the central focal point — instantly recognisable as the hero of the poster.',
      'Do NOT add any text other than the title, the optional co-star credit, and the watermark below. Do not add caption tags, fictional production company names, or other extraneous text.',
    );
  } else if (format === 'historical_portrait') {
    promptLines.push(
      `Vertical formal portrait aspect ratio. The cat's name is "${cat.name}" and the historical persona being portrayed is "${genre.title}".`,
      'Make the cat the sole subject, dignified and centered in classical portrait composition (three-quarter or three-quarter-profile view).',
      'Do NOT add any text on the painting itself other than the watermark below. Imagine this hangs in a museum — the title appears on the museum plaque (not in the image), not on the canvas.',
    );
  } else if (format === 'classical_painting') {
    promptLines.push(
      `Faithful recreation of the source painting with the cat in the role of the original subject. Match the original\'s composition, palette, brush technique, and aspect ratio.`,
      'The cat\'s name is irrelevant in the artwork itself — paint as if it would hang in the original museum (Louvre, MoMA, Mauritshuis) without modification.',
      'Do NOT add any title text, signature, or modern decorative element other than the watermark below. The artwork should be indistinguishable from a museum reproduction except for the cat replacing the original subject and the small watermark.',
    );
  } else if (format === 'studio_ghibli') {
    promptLines.push(
      'Vertical aspect ratio. The cat is the central character of the scene, in a Ghibli-typical thoughtful or wonder-filled pose.',
      'Hand-painted watercolor aesthetic with visible paper texture, soft cel-shading, gentle Ghibli colour palette.',
      'Do NOT add title text or studio logos on the artwork other than the watermark below — render as a frame from the source film, not as a poster.',
    );
  } else if (format === 'pixar_key_art') {
    promptLines.push(
      'Vertical key-art aspect ratio. The cat is the heroic central character, expressive and stylized.',
      '3D-rendered Pixar character art aesthetic — soft volumetric lighting, painterly stylization, cinematic depth of field, expressive eyes preserved as the cat\'s actual eye color.',
      'Do NOT add title text or studio logos on the artwork other than the watermark below.',
    );
  } else if (format === 'anime_cell') {
    promptLines.push(
      'Vertical anime-cell aspect ratio. The cat is the central character with anime-stylized large expressive eyes (preserve the cat\'s actual eye color).',
      'Hand-drawn cel-paint aesthetic — visible cel texture, bold ink linework, era-appropriate compositing.',
      'Do NOT add title text or studio logos on the artwork other than the watermark below.',
    );
  }

  // Brand watermark — applies to ALL formats. Small, subtle, in a
  // corner so it doesn't compete with the artwork. Style-blends into
  // the host format (gold serif on a movie poster; thin pencil mark
  // in a corner of a painting; small kanji-styled stamp on a Ghibli
  // scene; small subtitle font on Pixar key art; small Japanese-side
  // edge stamp on anime). When users share these posters, the
  // watermark travels back to the brand. Failure mode: gpt-image-1
  // sometimes refuses to render specific text — we accept that and
  // can add a code-side overlay later if reliability is a problem.
  promptLines.push(
    '',
    'WATERMARK (REQUIRED): include a small, subtle "catmd.pet" wordmark in the BOTTOM-RIGHT corner of the image. Render it in a font + colour that complements the artwork style (e.g. small gold serif on a movie poster; faint engraved-look mark in a corner of a classical painting; small white edge stamp on a Pixar key-art; small kanji-flavoured calligraphy on Ghibli or anime works). It should be visible but not distracting — about 2-3% of the image height. Do not skip the watermark.',
  );

  if (hasRef) {
    promptLines.push(
      '',
      `IDENTITY LOCK (HIGHEST PRIORITY — DO NOT DEVIATE):`,
      ``,
      `The reference image is ${cat.name}, a real cat the user owns. The output MUST depict THIS SPECIFIC CAT — the same individual visible in the reference photo — rendered in the artwork style described above. Not a stylized cat that looks "kind of like" the reference. Not a generic cat in the genre's aesthetic. The SAME CAT.`,
      ``,
      `Match the reference EXACTLY on every visual feature below — these are non-negotiable:`,
      `  • Face structure: head shape, muzzle proportion, cheek width, forehead height, jawline.`,
      `  • Coat colour AND pattern: solid / tabby (mackerel, classic, ticked) / tuxedo / pointed / bicolor / calico / tortoiseshell — replicate the EXACT pattern, not just an approximation.`,
      `  • Eye colour: green, yellow, copper, amber, blue, heterochromia — match the reference precisely. Do not change eye colour for "drama" or "the genre's style".`,
      `  • Ear shape AND set: upright / folded (Scottish Fold) / curled (American Curl) / large-and-tufted (Maine Coon) / small. Match the reference.`,
      `  • Coat length AND texture: short-hair sleek / medium / long-hair fluffy / curly. Match.`,
      `  • Build: slim / medium / stocky-cobby / lanky-oriental. Match.`,
      `  • Distinguishing marks: white chest blaze, white sock pattern on paws, white tail tip, facial spots, ear tufts, mask-style face markings, freckles on nose. EVERY distinguishing mark in the reference MUST appear in the output in the same place.`,
      `  • Nose colour: pink / black / spotted / brown — match.`,
      ``,
      `THINK OF IT THIS WAY: if the user's friend sees the generated artwork, they should immediately say "oh that's ${cat.name}!" — recognising the specific individual, not just "a cat in the [genre] style". Style change yes, identity change NO.`,
      ``,
      `If the artwork's pose / costume requires the cat to be in an unusual position, transform the pose but keep the FACE recognisable as ${cat.name}'s face. The face is the most important identity-bearing feature. Do not stylize the face into a generic anime / cartoon / classical-art version — keep ${cat.name}'s actual face features (markings, eye shape, nose, expression set) and let the rest of the body/costume/setting carry the genre style.`,
    );
  } else {
    promptLines.push(
      '',
      'No reference photo provided — render a generic but on-brand cat for this genre.',
    );
  }

  const prompt = promptLines.join('\n');

  // Try the full prompt first. If gpt-image-1's safety moderator
  // rejects it (HTTP 400 with "safety" / "content policy" / "rejected"
  // in the error body), retry ONCE with a softened version that
  // strips combat / weapon / threat-adjacent language. The retry
  // keeps the genre's core aesthetic intact; only the
  // potentially-flagged language is sanitised. If the retry ALSO
  // fails we surface the error — the caller's try/catch will show a
  // friendly retry CTA.
  let b64: string;
  try {
    b64 = await generateImage({
      activity: 'cat_studio_poster',
      prompt,
      referenceImageBase64: catPhotoBase64 ?? null,
      size: '1024x1536',
      quality: 'medium',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
    const looksLikeSafetyReject =
      msg.includes('safety') ||
      msg.includes('content policy') ||
      msg.includes('rejected') ||
      msg.includes('400');
    if (!looksLikeSafetyReject) throw e;

    // Sanitise the prompt by stripping combat / threat / dystopian
    // language. We replace specific words with safer alternatives;
    // the rest of the styleDirection (period, palette, composition)
    // survives so the genre still reads correctly.
    const sanitisedPrompt = prompt
      .replace(/\b(battle|battlefield|battle stance)\b/gi, 'heroic stance')
      .replace(/\b(fierce|menacing|aggressive|threatening)\b/gi, 'confident')
      .replace(/\b(dystopian|post-apocalyptic)\b/gi, 'futuristic')
      .replace(/\b(weapon|dagger|sword|gun|rifle)\b/gi, 'prop')
      .replace(/\b(crackling lightning|alien fleet|space battle)\b/gi, 'glowing energy');

    // Telemetry — record the first error so we can cluster failures
    // and tighten prompts. Truncated to 200 chars to keep PostHog
    // payload small.
    const firstError =
      e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);

    try {
      b64 = await generateImage({
        activity: 'cat_studio_poster',
        prompt: sanitisedPrompt,
        referenceImageBase64: catPhotoBase64 ?? null,
        size: '1024x1536',
        quality: 'medium',
      });
      track({
        type: 'cat_studio_safety_retried',
        props: {
          genre: genre.id,
          theme: genre.theme,
          retry_succeeded: true,
          first_error: firstError,
        },
      });
    } catch (retryErr) {
      track({
        type: 'cat_studio_safety_retried',
        props: {
          genre: genre.id,
          theme: genre.theme,
          retry_succeeded: false,
          first_error: firstError,
        },
      });
      throw retryErr;
    }
  }

  if (!b64) throw new Error('Image generation returned empty result');

  return {
    id: `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    cat_id: cat.id,
    genre_id: genre.id,
    image_b64: b64,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Weekly auto-generation helpers
// ---------------------------------------------------------------------------
//
// On Sunday at 10:00 local time, Cat Studio auto-generates a poster
// from the past 7 days of cat photos and pushes a notification. The
// generation itself is LAZY — the schedule fires the notification only;
// when the user taps it (or otherwise opens the screen on/after Sunday
// 10am), the screen detects "no auto-poster for this studio week yet"
// and runs the generation. This sidesteps Android background-execution
// constraints while preserving the "user lands on tab and sees the
// poster" UX.

/**
 * Returns the most-recent Sunday at 10:00 local that has already passed.
 * If `now` is exactly Sunday 10:00 → returns that. If Sunday before
 * 10am → returns the previous Sunday. Used by the screen to decide
 * whether the current "studio week" has a fresh auto-poster yet.
 */
export function getStudioWeekAnchor(now: Date = new Date()): Date {
  const out = new Date(now);
  out.setHours(10, 0, 0, 0);
  const dayOffset = out.getDay(); // 0 = Sunday … 6 = Saturday
  out.setDate(out.getDate() - dayOffset);
  if (out.getTime() > now.getTime()) {
    out.setDate(out.getDate() - 7);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Theme-of-the-week rotation
// ---------------------------------------------------------------------------

/**
 * Six-week rotation order. Cycles forever. Each entry must match a
 * `theme` string in the GENRES array — when this week's theme name
 * doesn't exist in GENRES (typo, etc.), the picker falls back to the
 * full GENRES list as a defensive measure.
 *
 * Order designed for variety: famous-cinema → historical → classical
 * fine art → animated whimsy → modern animation → retro animation.
 */
export const THEME_ROTATION = [
  'Movie posters',
  'Historical figures',
  'Famous paintings',
  'Studio Ghibli scenes',
  'Pixar characters',
  '80s anime',
] as const;

/**
 * Stable epoch anchor for the rotation: Sunday 2026-05-03 10:00 UTC.
 * Week 0 of the rotation begins at this anchor. The current week's
 * index is `floor((current_sunday - epoch) / 7 days)`. Don't change
 * this constant once shipped — every install computes the SAME theme
 * for the SAME week regardless of timezone, install date, etc., and
 * users would experience a sudden jump if it moved.
 */
const ROTATION_EPOCH_MS = new Date(Date.UTC(2026, 4, 3, 10, 0, 0)).getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns this week's active theme name + next week's, plus the week
 * index for telemetry. Both names guaranteed to appear in
 * THEME_ROTATION; consumers can pass `thisWeek` to `getVariantsForTheme`
 * to fetch variants the user can choose from.
 */
export function getThemeForWeek(now: Date = new Date()): {
  thisWeek: (typeof THEME_ROTATION)[number];
  nextWeek: (typeof THEME_ROTATION)[number];
  weekIndex: number;
  /** Next Sunday-10am (when the rotation will flip). Used for the
   *  "Next week, on [date]" anticipation copy. */
  nextRotationAt: Date;
} {
  const anchor = getStudioWeekAnchor(now);
  const ms = anchor.getTime() - ROTATION_EPOCH_MS;
  const weekIndex = Math.floor(ms / WEEK_MS);
  // Modulo that handles negative weeks correctly (in case someone has
  // a clock set before the epoch — defensive).
  const len = THEME_ROTATION.length;
  const thisIdx = ((weekIndex % len) + len) % len;
  const nextIdx = (thisIdx + 1) % len;
  const nextRotationAt = new Date(anchor.getTime() + WEEK_MS);
  return {
    thisWeek: THEME_ROTATION[thisIdx]!,
    nextWeek: THEME_ROTATION[nextIdx]!,
    weekIndex,
    nextRotationAt,
  };
}

/**
 * Variants available under a given theme. Defensive — if no variants
 * match (theme typo, dataset out of sync), returns the full GENRES
 * list so the picker isn't empty.
 */
export function getVariantsForTheme(theme: string): Genre[] {
  const matches = GENRES.filter((g) => g.theme === theme);
  return matches.length > 0 ? matches : GENRES;
}

/**
 * Pick a random variant for the current week's theme, ideally
 * avoiding the most-recent posters' variants for variety. With small
 * theme pools (Pixar = 2, 80s anime = 2) the anti-repeat falls back
 * gracefully — better to repeat a variant within a week than fail.
 */
export function pickFreshGenre(opts: {
  recentPosters: CatStudioPoster[];
  recentN?: number;
  /** Override for tests; defaults to current week's theme. */
  now?: Date;
}): Genre {
  const recentN = opts.recentN ?? 3;
  const { thisWeek } = getThemeForWeek(opts.now ?? new Date());
  const themeVariants = getVariantsForTheme(thisWeek);
  const recentGenreIds = new Set(
    opts.recentPosters.slice(0, recentN).map((p) => p.genre_id),
  );
  const candidates = themeVariants.filter((g) => !recentGenreIds.has(g.id));
  const pool = candidates.length > 0 ? candidates : themeVariants;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx]!;
}

/**
 * Pick the best photo to hand to the image-gen model as a reference.
 *
 * Priority order (top → bottom; first available wins):
 *   1. The cat's profile photo (cat.photo_uri) — this is what the user
 *      curated as the canonical "this is Lily" image. It's the SHARPEST
 *      identity signal we have.
 *   2. Recent gallery photo where identity matching CONFIRMED Lily is
 *      present with confidence ≥ 0.6 — the model has verified it's her.
 *   3. Any recent gallery photo within the window (best-effort —
 *      identity check may not have run, or may have failed). Worse than
 *      a confirmed match but better than nothing.
 *   4. null — generation still proceeds, the cat will look generic.
 *
 * Why profile-first changed (2026-05-02 evening): user feedback on
 * auto-generated posters — "this is cute, but this is not MY cat."
 * Was picking newest gallery photo, which may not even be of Lily in
 * a multi-cat household. Profile photo is the user's deliberate "this
 * is her" choice; lead with it.
 *
 * Returns the file:// URI; the store wraps it with base64 conversion.
 */
export function pickWeeklyReferencePhoto(opts: {
  cat: CatProfile;
  galleryRecent: PhotoStudioPhoto[];
  daysBack?: number;
}): string | null {
  // 1. Profile photo wins.
  if (opts.cat.photo_uri) return opts.cat.photo_uri;

  // No profile photo set — find the best gallery photo we can.
  const daysBack = opts.daysBack ?? 7;
  const cutoffMs = Date.now() - daysBack * 86400 * 1000;
  const recent = opts.galleryRecent
    .filter((p) => p.cat_id === opts.cat.id)
    .filter((p) => {
      const ts = Date.parse(p.added_at);
      return !Number.isNaN(ts) && ts >= cutoffMs;
    })
    .sort((a, b) => b.added_at.localeCompare(a.added_at));

  // 2. Identity-confirmed photo with high confidence — model verified
  // it's Lily. Highest signal short of the profile photo.
  const confirmed = recent.find(
    (p) =>
      p.target_present === true &&
      (p.target_confidence ?? 0) >= 0.6 &&
      // Single-cat photos are by definition unambiguous; multi-cat
      // photos with high confidence are also fine. We just exclude
      // photos where the identity check found NO Lily.
      p.cat_count !== 0,
  );
  if (confirmed) return confirmed.uri;

  // 3. Best-effort: any recent gallery photo (identity check may not
  // have run yet for new captures, or may have failed).
  if (recent.length > 0) return recent[0]!.uri;

  // 4. Nothing usable.
  return null;
}
