# CatMD — Google Play Store Listing Copy (Spanish)

_Source of truth for Spanish-locale Play Store entries. Paste each block into Play Console → Manage translations → es-MX (Mexican Spanish, primary for LATAM + US Hispanic) and es-ES (Castilian Spanish, primary for Spain)._

_Translation philosophy: native Spanish reading register, not literal English-via-DeepL. Both locales share 95% of the copy — only flagged deltas differ. Primary deltas: "ánimo" / "estado de ánimo" wording, "celular" (es-MX) vs "móvil" (es-ES), "puntaje" (es-MX) vs "puntuación" (es-ES). Marketing register is conversational and warm — matches the cat-companion brand voice._

_Drafted 2026-05-21. Recommended publish timing per marketing brief: Day 7 after initial English launch so the English ranking signal stabilises first._

---

## App title (50 char max) — IDENTICAL for both locales

```
CatMD — Tu gato, descifrado
```
_(27 chars)_

**Alt options:**
- `CatMD — IA para dueños de gatos` (31)
- `CatMD: La IA que entiende a tu gato` (35)

---

## Short description (80 char max)

### es-MX (Mexico, LATAM, US Hispanic)

```
IA que conoce a tu gato — ánimo, lenguaje corporal, postales y triaje.
```
_(70 chars)_

### es-ES (Spain)

```
IA que conoce a tu gato — ánimo, lenguaje corporal, postales y triaje.
```
_(70 chars)_

_Note: identical for both locales. The core vocabulary ("ánimo," "lenguaje corporal," "postales," "triaje") is universal Spanish._

---

## Full description (4000 char max)

### es-MX (Mexico, LATAM, US Hispanic)

```
CatMD es la IA para dueños de gatos.

Conoce a tu gato — su salud, ánimo, personalidad y vida diaria — y convierte ese conocimiento en algo que vas a usar todos los días. Diseñado solo para gatos, entrenado con medicina felina revisada por veterinarios.

Cuatro formas de conocer a tu gato:

🐾 HOY — Un check-in diario de 15 segundos.
Rachas, ánimo, apetito y un puntaje de salud en vivo que se ajusta cada vez que registras algo. El lector de lenguaje corporal y los patrones de Health Rhythm de 30 días detectan cambios antes de que se vuelvan un problema.

🐾 VÍNCULO — El lado de la relación.
• Personalidad: 9 arquetipos basados en cómo se comporta realmente tu gato
• Postales diarias: leyendas escritas por IA sobre collages de fotos, listas para compartir
• Diario diario: una entrada privada a las 7 PM con la propia voz de tu gato — hace referencia a días recientes, miembros de la familia con nombre y las cosas que le has contado sobre sí mismo
• Personas y mascotas: etiqueta a quién aparece en las fotos de tu gato; los nombres recurrentes se entretejen en el diario como recuerdos
• Becoming: un puntaje de identidad de 7 facetas (cara, voz, cuerpo, ritmo, familia, naturaleza, memoria) que muestra cuán formado está tu gato en la app
• Pósters de cine: retratos generados por IA semanalmente, con temas rotativos
• Time-lapse de fotos: míralo crecer, con reproducción mensual

🐾 CHAT — Conversa con tu gato.
Tu gato responde en primera persona, con la voz de su arquetipo de personalidad. Recuerda el diario, las personas con nombre en sus fotos y las cosas que le has contado sobre sí mismo ("te encanta el atún" → lo recuerda). Ante síntomas, pide ser examinado con su propia voz — y deriva al módulo de Triaje.

🐾 TRIAJE — Orientación de síntomas con calidad veterinaria.
Análisis por foto + texto con clasificación de urgencia, banderas rojas y preguntas de seguimiento. Más la Escala de Mueca Felina — un sistema de puntuación de dolor facial validado por investigación de la Universidad de Montreal (Evangelista et al., 2019). Vacunas, registro de peso y monitores específicos por enfermedad mantienen el historial longitudinal que les importa a los veterinarios.

¿POR QUÉ CATMD?
• IA que conoce a TU gato — cada interacción ve su raza, edad, personalidad, familia con nombre, diario reciente y lo que le has contado sobre sí mismo. No es una app genérica de mascotas con un filtro de gato.
• Diseñado solo para gatos — cada función está afinada para el comportamiento, anatomía y patrones de riesgo felinos. Sin dilución canina.
• Privado por diseño — fotos, diario y datos personales se quedan en tu dispositivo. Los miembros Pro tienen respaldo en la nube para que el historial de su gato los siga a cualquier dispositivo.
• Ritual diario, no herramienta de crisis — la mayoría de los días abrirás CatMD solo para hacer check-in, conversar con tu gato, compartir una postal, ver el ánimo del día. El Triaje está ahí cuando lo necesites; la mayor parte del tiempo no lo necesitarás.

CatMD usa IA (GPT-4o, Whisper, gpt-image-1) para interpretar fotos, comportamiento y audio. No sustituye la atención veterinaria — ante emergencias, contacta a tu veterinario inmediatamente.

Hecho por amantes de los gatos, en consulta con veterinarios de medicina felina. Disponible en todo el mundo.

⚠️ CatMD es solo informativo. No es asesoría veterinaria, diagnóstico ni tratamiento, y no reemplaza a un veterinario con licencia. Ante una emergencia médica, contacta inmediatamente a tu veterinario de emergencias más cercano.
```

_(approx 2,950 chars / 4,000 — within limits)_

### es-ES (Spain) — only the deltas (everything else identical to es-MX above)

Replace these specific phrases in the es-MX version:

| es-MX phrase | es-ES replacement | Reason |
|---|---|---|
| `un puntaje de salud en vivo` | `una puntuación de salud en directo` | "puntuación" + "en directo" are more natural in Spain |
| `un puntaje de identidad de 7 facetas` | `una puntuación de identidad de 7 facetas` | Same — "puntaje" is LATAM; "puntuación" is Spain |
| `dueños de gatos` | `dueños de gatos` | IDENTICAL — both regions use this |
| `te encanta el atún` | `te encanta el atún` | IDENTICAL |
| `disponible en todo el mundo` | `disponible en todo el mundo` | IDENTICAL |
| `lo recuerda` | `lo recuerda` | IDENTICAL |

_The es-ES full description is the same as es-MX with only the two `puntaje` → `puntuación` swaps. Easier to paste: copy the es-MX block, then Ctrl-F replace "puntaje" → "puntuación"._

---

## Release notes (vc 101) — paste into "What's new" per locale

### English source (for reference)

```
• Lily warms up over time. Brand-new cats are curious and ask questions back; long-known cats become intimate and observational — the voice now matures with your bond.
• Cleaner Chat header.
• Fixed: cat no longer fabricates past activities on day 1.
• Engagement: small curious questions back on early days, intimate observation as you bond.
```

### es-MX

```
• Tu gato madura con el tiempo. Los gatos nuevos son curiosos y hacen preguntas; los gatos conocidos por mucho tiempo se vuelven íntimos y observadores — la voz ahora evoluciona junto con tu vínculo.
• Encabezado de chat más limpio.
• Corregido: el gato ya no inventa actividades pasadas el primer día.
• Engagement: pequeñas preguntas curiosas los primeros días, observación íntima al fortalecerse el vínculo.
```
_(490 chars — within the 500-char limit)_

### es-ES

```
• Tu gato madura con el tiempo. Los gatos nuevos son curiosos y te hacen preguntas; los gatos conocidos durante mucho tiempo se vuelven íntimos y observadores — la voz ahora evoluciona junto con tu vínculo.
• Encabezado de chat más limpio.
• Corregido: el gato ya no se inventa actividades pasadas el primer día.
• Engagement: pequeñas preguntas curiosas los primeros días, observación íntima a medida que se fortalece el vínculo.
```
_(505 chars — JUST over the 500-char limit; trim "el primer día" → "al inicio" if needed: that drops it to ~498)_

---

## Screenshot captions (≤80 char each)

### Screenshot 1 — Today (anchor)

**English source:** "Daily check-in, health score, and your cat's mood — all in 15 seconds"

**es-MX:**
```
Check-in diario, puntaje de salud y el ánimo de tu gato — en 15 segundos.
```
_(74 chars)_

**es-ES:**
```
Check-in diario, puntuación de salud y el ánimo de tu gato — en 15 segundos.
```
_(76 chars)_

### Screenshot 7 — Chat

**English source:** "Talk to your cat. She replies in her own voice — and remembers what you tell her."

**es-MX:**
```
Conversa con tu gato. Responde con su propia voz y recuerda lo que le cuentas.
```
_(78 chars)_

**es-ES:**
```
Habla con tu gato. Responde con su propia voz y recuerda lo que le cuentas.
```
_(75 chars)_

_Note: "conversa con" (es-MX, more conversational) vs "habla con" (es-ES, more direct). Both work in either region, but each is the more native option for its locale._

---

## Step-by-step Play Console upload

1. Open Play Console → CatMD app → **Grow** → **Store settings** → **Main store listing** → click the language dropdown at the top → **Manage translations** → **Add translations**
2. Select **Spanish (Mexico) — es-MX** and **Spanish (Spain) — es-ES** (both)
3. For each locale, fill in:
   - **App name** (title — 50 char): paste the es-MX/es-ES title (they're identical)
   - **Short description** (80 char): paste the locale-specific short description
   - **Full description** (4000 char): paste the locale-specific full description
4. Switch to **Production** → **Releases** → find the active vc 101 release → **Edit release** → **Release notes** → click the language dropdown → add the es-MX + es-ES release notes
5. **Screenshots** are uploaded per-locale separately. For the initial Spanish launch, **the same 8 English screenshots will display by default for Spanish locales** — there's no requirement to localise the images for v1 (the captions are what gets translated, not the in-app text in the screenshots).
6. Optionally: add localised screenshot captions under each screenshot in the per-locale view (≤80 char each, see captions section above).
7. **Save changes** → **Submit for review** (Play typically auto-approves locale additions in <24h since the actual app build doesn't change).

---

## Pre-publish QA checklist

Before clicking Submit, verify:

- [ ] Title is identical across both locales (both use "CatMD — Tu gato, descifrado")
- [ ] Short description is exactly 70 chars in both (no truncation in SERP)
- [ ] Full description has been pasted in full (4000 char ceiling not hit)
- [ ] Release notes are within the 500-char limit per locale (the es-ES version is at 505 — trim "el primer día" → "al inicio" before paste, or accept truncation in the SERP-snippet)
- [ ] No accents are mangled (Play Console handles UTF-8, but double-check ñ, é, í, á, ó, ú render correctly on the preview screen)
- [ ] The es-MX "puntaje" / es-ES "puntuación" delta is correctly swapped in each locale's full description (don't paste the wrong one)

---

## Optional polish (Day 14+)

If Spanish-locale install rate is meaningfully positive after 2 weeks (≥1.3× the English-rate per impression — the marketing brief's target), consider:

1. **Spanish-speaker spot-check** of the short description and the first ~200 chars of the full description (the most-read fields). A native-eyeball pass catches the small register-mismatches an LLM translation can miss (e.g., "vínculo" vs "lazo," "ánimo" vs "humor").
2. **Localized screenshots** — capture the app with the system locale set to Spanish. The PersonalityProgressBanner, chat empty-state, and triage result currently render in English regardless of system locale, so this is largely cosmetic for v1. Becomes higher-priority once the app itself supports Spanish UI strings.
3. **Add Portuguese (Brazil) — pt-BR** as the next locale. Brazil is the third-largest pet market globally and has cultural overlap with the cat-content trend in LATAM.

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-21 | Initial Spanish translation drafted. Both es-MX + es-ES variants prepared. Recommended publish: Day 7 after vc 101 English launch (~2026-05-28). |
