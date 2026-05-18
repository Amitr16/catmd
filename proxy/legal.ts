/**
 * Legal landing pages served by the CatMD Cloudflare Worker:
 *   GET /privacy    → privacy policy
 *   GET /terms      → terms of service
 *   GET /disclaimer → medical disclaimer
 *   GET /legal      → index linking the three above
 *
 * Content is authored in docs/legal/*.md (source of truth, version-
 * controlled). The HTML bodies below mirror that content with the same
 * section numbering and headings so anyone comparing the two sees the
 * exact same substance. Update both when making material changes.
 *
 * Branding matches the app's Warm Clinical palette and serif-for-heads
 * type pairing so users arriving from an email link or Play Store
 * listing recognise they're on the right site.
 */

const LAST_UPDATED = '2026-05-13';
const CONTACT_EMAIL = 'support@catmd.pet';
const LEGAL_NAME = 'CatMD';
const JURISDICTION = 'Singapore';

/**
 * Shared HTML chrome — header, footer, and CSS. Every legal page calls
 * this with a title + body. Keeps styling consistent and edits cheap.
 */
export function renderLegalPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)} — CatMD</title>
<meta name="robots" content="noindex" />
<style>
  :root {
    --cream:#FAF7F2; --sage:#3F6456; --dark-sage:#25403A;
    --ink:#1F2024; --muted:#7A7160; --border:#E6E0D3;
    --surface:#FFFFFF;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:var(--cream); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    line-height:1.55; }
  .wrap { max-width:720px; margin:0 auto; padding:40px 20px 80px; }
  header { padding:24px 20px; border-bottom:1px solid var(--border);
    background:var(--cream); }
  .brand { max-width:720px; margin:0 auto;
    font-size:13px; letter-spacing:3px; text-transform:uppercase;
    color:var(--muted); font-weight:700; }
  h1 { font-family:Georgia,'Times New Roman',serif; font-size:32px;
    margin:0 0 4px; font-weight:500; }
  h2 { font-family:Georgia,'Times New Roman',serif; font-size:20px;
    margin:32px 0 8px; color:var(--sage); font-weight:500; }
  h3 { font-size:16px; margin:20px 0 4px; }
  p,li { font-size:15px; color:#2a2a2a; }
  ul { padding-left:22px; }
  li { margin:4px 0; }
  a { color:var(--sage); }
  table { width:100%; border-collapse:collapse; margin:12px 0 18px;
    font-size:14px; }
  td,th { padding:8px 10px; text-align:left; vertical-align:top;
    border-bottom:1px solid var(--border); }
  th { color:var(--muted); font-size:12px; text-transform:uppercase;
    letter-spacing:0.5px; font-weight:600; }
  code { background:#f0eade; padding:2px 6px; border-radius:4px;
    font-size:13px; }
  hr { border:0; border-top:1px solid var(--border); margin:32px 0; }
  .muted { color:var(--muted); font-size:13px; }
  .nav { margin-top:24px; font-size:13px; color:var(--muted); }
  .nav a { margin-right:16px; }
  .callout { background:var(--surface); border:1px solid var(--border);
    border-left:4px solid var(--sage); padding:14px 18px;
    border-radius:6px; margin:16px 0; font-size:14px; }
  .warn { border-left-color:#8B2F1F; }
  .cta { display:inline-block; padding:14px 28px; background:var(--sage);
    color:var(--cream); text-decoration:none; border-radius:999px;
    font-weight:700; font-size:16px; margin:16px 0; }
  .cta:hover { background:var(--dark-sage); }
  footer { border-top:1px solid var(--border); padding:20px; text-align:center;
    font-size:12px; color:var(--muted); }
  footer a { color:var(--muted); }
</style>
</head>
<body>
<header>
  <div class="brand">CatMD</div>
</header>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <div class="muted">Last updated: ${LAST_UPDATED}</div>
  <div class="nav">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/disclaimer">Medical disclaimer</a>
  </div>
  <hr/>
  ${bodyHtml}
  <hr/>
  <p class="muted">
    Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
    \u00b7 Based in ${JURISDICTION}.
  </p>
</div>
<footer>
  &copy; ${new Date().getFullYear()} CatMD \u00b7 Informational only \u2014 not veterinary advice.
</footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Privacy policy ─────────────────────────────────────────────────────────

export function renderPrivacy(): string {
  const body = `
<p>This Privacy Policy explains how <strong>CatMD</strong> ("we", "us", "our") collects, uses, and protects information when you use the CatMD mobile application (the "App"). CatMD is an informational app for cat owners — it is <strong>not</strong> a substitute for professional veterinary advice. See the <a href="/disclaimer">Medical Disclaimer</a> and <a href="/terms">Terms of Service</a>.</p>

<h2>1. Summary in plain English</h2>
<ul>
  <li><strong>We collect as little as possible.</strong> By default you use CatMD with an anonymous account &mdash; no email, no name, no real-world identity.</li>
  <li><strong>Your cat's profile, scans, diary, and chat history live on your device first.</strong> We mirror them to our secure database so you can recover them if you change phones, but we never sell or share them.</li>
  <li><strong>Photos, videos, and audio recordings you submit</strong> (for scans, body-language readings, meow translations, postcards, themed art) are sent to our AI processing partner (OpenAI) to generate the response you asked for. They are stored with the corresponding record in your history so you can revisit it; deleting the record deletes the file.</li>
  <li><strong>Approximate location</strong> (rounded to ~10 km, e.g. city-region level) is used only to fetch local weather so your cat can reference real conditions in chat and diary. We never store precise GPS coordinates. Location is optional &mdash; the App works without it, minus the weather references.</li>
  <li><strong>AI-generated content.</strong> Chat replies, diary entries, meow translations, postcards, themed art, daily cards, and scan summaries are AI-generated &mdash; treat them as creative interpretation or observations, not as factual claims or medical advice.</li>
  <li><strong>You can delete everything at any time.</strong> The "Forget everything about my cat" button in Settings permanently erases your cats, scans, photos, videos, audio, diary, and chat history from our servers and your device. You can also request deletion without the app at <a href="/delete-account">/delete-account</a>.</li>
</ul>

<h2>2. Who we are</h2>
<p>The App is operated by <strong>CatMD</strong> ("we", "us"), based in <strong>${JURISDICTION}</strong>. For privacy questions, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>3. What we collect and why</h2>
<h3>3.1 Data you provide directly</h3>
<ul>
  <li><strong>Cat profile:</strong> name, breed (optional), date of birth / age (optional), weight (optional), sex, spay/neuter status, indoor/outdoor, known medical conditions, current medications, photo, free-text notes, emergency vet contact. <em>Why:</em> so CatMD can tailor responses to your specific cat.</li>
  <li><strong>Scan inputs:</strong> the text you type describing symptoms and any photo you attach. <em>Why:</em> to analyse the situation.</li>
  <li><strong>Body-language videos (~6 seconds):</strong> short clips of your cat for posture and motion analysis. <em>Why:</em> to generate a body-language reading.</li>
  <li><strong>Meow audio recordings (~4&ndash;20 seconds):</strong> short audio clips of your cat vocalising, optionally paired with a still photo. <em>Why:</em> to generate a meow translation.</li>
  <li><strong>Chat messages:</strong> text you type to your cat. <em>Why:</em> to generate the cat's reply.</li>
  <li><strong>Daily check-ins:</strong> mood, appetite, water, litter, weight &mdash; all optional. <em>Why:</em> to feed the diary and surface health trends.</li>
  <li><strong>Tagged photos:</strong> photos with optional people / other-pet tags. <em>Why:</em> so the cat can reference named family members and other pets in chat and diary.</li>
  <li><strong>Account email</strong> (only if you choose to add one &mdash; anonymous use does not require an email). <em>Why:</em> to let you recover your data on a new device and confirm Pro subscriptions. <strong>No password is required</strong> &mdash; we use one-time 6-digit codes ("OTP") sent to your email.</li>
  <li><strong>Health-log entries:</strong> vaccinations, medications, weights, appointments, symptom photos, water intake, litter-box use, respiratory rate, pain scores, outcome check-ins, feeding notes &mdash; all optional and owner-entered.</li>
</ul>
<h3>3.2 Data we generate for you</h3>
<ul>
  <li><strong>Scan / triage results:</strong> observation summary, severity score, plain-language interpretation, suggested next steps. Stored with your scan.</li>
  <li><strong>Body-language readings:</strong> structured observations (eyes, ears, tail, body, motion). Stored with the reading.</li>
  <li><strong>Meow translations:</strong> AI-generated interpretation of the vocalisation paired with the audio and any optional photo.</li>
  <li><strong>Diary entries:</strong> AI-written daily journal in your cat's voice, based on the day's activity.</li>
  <li><strong>Daily card, weekly reading, postcards, themed art:</strong> AI-generated shareable content.</li>
  <li><strong>Chat replies:</strong> AI-generated responses from your cat's perspective.</li>
  <li><strong>Memory items:</strong> objects, places, named people, and pets the AI extracts from your photos and chat. The cat then references these by name to feel personalised.</li>
  <li><strong>Reminders:</strong> if you enable a medication or check-in reminder, we schedule a local notification on your device. These are not sent through our servers.</li>
</ul>
<h3>3.3 Data we automatically receive</h3>
<ul>
  <li><strong>Anonymous account identifier</strong> &mdash; a randomly generated user ID that lets the App persist your data without knowing who you are.</li>
  <li><strong>Approximate location</strong> &mdash; when you grant location permission, we fetch your coarse coordinates (rounded to ~10 km, e.g. city-region level) <strong>only</strong> to retrieve local weather from Open-Meteo so your cat can reference real weather in chat and diary. We never store precise GPS coordinates. If you deny location permission, the App works exactly the same minus weather references.</li>
  <li><strong>Technical data:</strong> app version, OS version, device model, crash reports, anonymised usage analytics. Helps us fix bugs and improve the App.</li>
  <li><strong>Purchase data:</strong> if you subscribe to Pro, our subscription processor (RevenueCat) receives your anonymous user ID and the Google Play / Apple receipt. We do <strong>not</strong> receive or store your credit card or payment method &mdash; that stays with Google / Apple.</li>
</ul>

<h2>4. AI-generated content</h2>
<p>CatMD uses generative AI to produce chat replies, diary entries, meow translations, daily cards, postcards, themed art, and scan summaries.</p>
<ul>
  <li><strong>Content is AI-generated, not authoritative.</strong> Treat scan and body-language outputs as observations to discuss with a vet, never as a diagnosis. Treat chat / diary / postcard content as creative interpretation, not factual claims.</li>
  <li><strong>You can report problematic AI output.</strong> If a generated response is inaccurate, offensive, or unsafe, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with the screenshot or the scan / chat ID. We review reports within 7 days and update our prompts and guardrails accordingly.</li>
  <li><strong>No training on your data.</strong> Our AI partners process your inputs in real time to return a result. We do not consent to your data being used to train their general-purpose models.</li>
</ul>

<h2>5. Who we share data with</h2>
<p>We use the following sub-processors. Each is contractually obliged to handle your data for our purposes only.</p>
<table>
  <thead><tr><th>Processor</th><th>Purpose</th><th>Data shared</th></tr></thead>
  <tbody>
    <tr><td><strong>Supabase, Inc.</strong></td><td>Hosting, database, authentication</td><td>Cat profile, scans, body-language reads, meow translations, diary, chat, account identifier, optional email</td></tr>
    <tr><td><strong>OpenAI, LLC</strong></td><td>AI text + image + audio analysis (chat, diary, scan, body-language read, meow translation, postcard captions, themed art)</td><td>Your text, attached photos, attached videos, audio clips &mdash; sent at the moment of the request</td></tr>
    <tr><td><strong>Open-Meteo</strong></td><td>Weather data</td><td>Coarse coordinates rounded to ~10 km, no identifier</td></tr>
    <tr><td><strong>Cloudflare, Inc.</strong></td><td>Network proxy, landing pages</td><td>All API + web traffic (metadata only, not bodies at rest)</td></tr>
    <tr><td><strong>Sentry, Inc.</strong> (if enabled)</td><td>Crash reporting</td><td>Crash reports with de-identified device info</td></tr>
    <tr><td><strong>PostHog, Inc.</strong> (if analytics enabled)</td><td>Product analytics</td><td>Anonymous usage events</td></tr>
    <tr><td><strong>RevenueCat, Inc.</strong> (if you subscribe)</td><td>Subscription management</td><td>Anonymous user ID + purchase receipts</td></tr>
    <tr><td><strong>Google LLC / Apple Inc.</strong></td><td>Store billing</td><td>Payment processed by Google Play Billing or Apple App Store &mdash; they receive your payment method, we never do</td></tr>
  </tbody>
</table>
<p>We do <strong>not</strong> sell your personal data. We do <strong>not</strong> share your data with advertisers.</p>

<h2>6. How long we keep data</h2>
<ul>
  <li><strong>Cat profiles, scans, body-language readings, meow translations, diary entries, chat history, photos, videos, audio, health logs, reminders:</strong> kept until you delete them or your account.</li>
  <li><strong>Photos attached to scans, postcards, or studio art:</strong> kept with the record. Deleting the record deletes the file.</li>
  <li><strong>Audio recordings (meow translator):</strong> kept with the translation record. Deleting the translation deletes the audio.</li>
  <li><strong>Videos (body-language):</strong> kept with the reading record. Deleting the reading deletes the video.</li>
  <li><strong>Weather coordinates:</strong> cached locally for 6 hours, never persisted server-side beyond that cache.</li>
  <li><strong>Anonymous analytics:</strong> retained for 24 months maximum.</li>
  <li><strong>Crash reports:</strong> retained for 90 days.</li>
  <li><strong>Scan-usage counters</strong> (for fair-use limits): retained indefinitely, tied to your user ID only.</li>
</ul>

<h2>7. Your rights</h2>
<p>Depending on your location, you have the right to access, rectify, erase, port, restrict, or object to the processing of your data, and to withdraw consent at any time. In Singapore, the Personal Data Protection Act 2012 (PDPA) governs these rights; residents of the EU/UK also have rights under the GDPR.</p>
<p>To exercise any right:</p>
<ul>
  <li>Use <strong>Settings &rarr; Forget everything about my cat</strong> in the App to hard-delete your data immediately, OR</li>
  <li>Visit <a href="/delete-account">/delete-account</a> to request deletion without the app, OR</li>
  <li>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</li>
</ul>
<p>We respond to rights requests within 30 days.</p>

<h2>8. Children</h2>
<p>CatMD is not intended for users under 13 (under 16 in the EU/UK or equivalent jurisdictions). We do not knowingly collect data from children. If you believe a child has used CatMD, email us and we will delete the associated data.</p>

<h2>9. Security</h2>
<ul>
  <li>Data in transit is encrypted with TLS 1.2+.</li>
  <li>Data at rest in our database is encrypted (AES-256, managed by Supabase).</li>
  <li>Photos, videos, and audio you submit are sent over TLS to OpenAI for processing. See OpenAI's API data-usage policy at <a href="https://openai.com/policies/api-data-usage-policies" rel="noopener">openai.com/policies/api-data-usage-policies</a>.</li>
  <li>You can run the App entirely anonymously. No identifier ties your scans to a real-world identity unless you add an email address.</li>
</ul>
<p>No system is perfectly secure. If we become aware of a breach affecting your data, we will notify you within 72 hours as required by law.</p>

<h2>10. International transfers</h2>
<p>Your data may be processed in the United States, the European Union, or other locations where our sub-processors operate. Where required, we rely on Standard Contractual Clauses or an adequacy decision for transfers out of your home jurisdiction.</p>

<h2>11. Changes to this policy</h2>
<p>If we change this policy we will update the "Last updated" date above and, for material changes, notify you in-app before the change takes effect.</p>

<h2>12. Contact</h2>
<p>For any privacy question or request, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. For account deletion without the app, see <a href="/delete-account">/delete-account</a>.</p>
`;
  return renderLegalPage('Privacy Policy', body);
}

// ── Terms of service ───────────────────────────────────────────────────────

export function renderTerms(): string {
  const body = `
<p>Welcome to <strong>CatMD</strong>. These Terms govern your use of the CatMD mobile application (the "App") provided by <strong>CatMD</strong> ("we", "us"). By installing or using the App, you agree to these Terms.</p>
<div class="callout warn">
  Read the <a href="/disclaimer">Medical Disclaimer</a> carefully. CatMD is <strong>not</strong> a veterinary service and <strong>not</strong> a substitute for professional veterinary advice, diagnosis, or treatment.
</div>

<h2>1. Who can use CatMD</h2>
<p>You must be at least <strong>13 years old</strong> (or 16 in the EU/UK) to use the App. If you are under the age of majority in your jurisdiction, you must have consent from a parent or guardian.</p>

<h2>2. Your account</h2>
<p>You can use CatMD anonymously &mdash; no email is required to use the App. You may optionally add an email address to enable cloud sync, cross-device restore, and Pro subscriptions. We use <strong>one-time 6-digit codes ("OTP")</strong> sent to your email for verification &mdash; no password is required. Keep your email account secure, since access to it is what enables CatMD sign-in. Notify us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> if you suspect unauthorised access.</p>

<h2>3. What CatMD is &mdash; and isn't</h2>
<h3>3.1 What it is</h3>
<p>CatMD is an <strong>AI-powered triage and education tool for cat parents</strong>. It helps you describe and track symptoms, get a structured assessment of urgency, prepare for a veterinary visit, and keep a private log of your cat's health over time.</p>
<h3>3.2 What it isn't</h3>
<p>CatMD does <strong>not</strong> diagnose disease, prescribe treatment or medication, replace a veterinarian, provide emergency medical services, or guarantee accuracy of any output.</p>
<p><strong>If your cat is experiencing a medical emergency, contact a licensed veterinarian or an emergency animal hospital immediately.</strong></p>

<h2>4. Subscriptions and payments</h2>
<h3>4.1 Free tier</h3>
<p>CatMD offers a free tier with limited monthly scans. The current free limits are shown in the App and may change with reasonable notice.</p>
<h3>4.2 Paid subscriptions</h3>
<ul>
  <li>Paid subscriptions are offered via the Google Play Store (and, in future, the Apple App Store). Billing is handled by the relevant platform.</li>
  <li><strong>Auto-renewal:</strong> subscriptions renew automatically at the end of each billing period unless cancelled at least 24 hours beforehand via your platform account settings.</li>
  <li><strong>Free trial:</strong> if you start a free trial, you will be charged at the end of the trial period unless you cancel beforehand.</li>
  <li><strong>Refunds:</strong> refund requests are handled by the platform provider (Google / Apple). We do not process refunds directly.</li>
</ul>
<h3>4.3 Price changes</h3>
<p>We may change prices with at least 30 days' notice. Existing subscriptions are honoured at the previously-agreed price until renewal.</p>

<h2>5. Acceptable use</h2>
<p>You agree <strong>not</strong> to:</p>
<ul>
  <li>use CatMD for anything other than cat health triage on cats you care for;</li>
  <li>attempt to reverse-engineer, decompile, or extract AI model outputs for commercial redistribution;</li>
  <li>spam, abuse, or overwhelm our servers;</li>
  <li>submit content that is unlawful, harmful, or infringing;</li>
  <li>use CatMD to provide veterinary services to third parties for profit without a separate commercial agreement;</li>
  <li>use CatMD to diagnose non-feline animals or humans.</li>
</ul>
<p>We may suspend or terminate access for breach of these Terms.</p>

<h2>6. Intellectual property</h2>
<p>The App, its branding, its UI, and the curated knowledge corpus ("CatMD Content") are owned by CatMD or its licensors and protected by copyright and other intellectual-property laws.</p>
<p><strong>Your content</strong> &mdash; the cat profiles, scan inputs, photos, and notes you provide &mdash; remains yours. You grant CatMD a limited, non-exclusive licence to process it <strong>only</strong> to deliver the App's functionality and to improve the App (for example, anonymised aggregate analytics). We do <strong>not</strong> train AI models on your content.</p>

<h2>7. Privacy</h2>
<p>Our handling of your data is described in the <a href="/privacy">Privacy Policy</a>. By using the App you consent to the data practices described there.</p>

<h2>8. Disclaimers</h2>
<p><strong>THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND</strong>, whether express, implied, statutory, or otherwise, including without limitation any warranty of merchantability, fitness for a particular purpose, or non-infringement.</p>
<p>Without limiting the above:</p>
<ul>
  <li>CatMD does <strong>not</strong> warrant that the AI output is accurate, complete, or up to date.</li>
  <li>CatMD does <strong>not</strong> warrant that the App is free from defects, errors, or interruptions.</li>
  <li>CatMD does <strong>not</strong> warrant any specific health outcome for your cat.</li>
</ul>
<p><strong>Your use of the App is at your own risk.</strong> Always consult a licensed veterinarian for veterinary advice or emergencies.</p>

<h2>9. Limitation of liability</h2>
<p>To the maximum extent permitted by law, <strong>CatMD shall not be liable for any indirect, incidental, consequential, special, or punitive damages</strong> &mdash; including without limitation loss of profits, loss of goodwill, loss of data, veterinary expenses, or harm to you or your cat &mdash; arising out of or in connection with your use of the App.</p>
<p>Our total aggregate liability for all claims arising out of or relating to these Terms or the App is limited to the greater of (a) the amount you have paid CatMD in the twelve months before the claim, or (b) USD $50.</p>
<p>Some jurisdictions do not allow the exclusion of certain warranties or the limitation of certain damages. In those jurisdictions, the above exclusions and limitations apply to the maximum extent permitted by law.</p>

<h2>10. Indemnification</h2>
<p>You agree to indemnify and hold CatMD harmless from any claim, demand, or damage &mdash; including reasonable attorneys' fees &mdash; arising out of your breach of these Terms, your misuse of the App, or your violation of another party's rights.</p>

<h2>11. Termination</h2>
<p>You may stop using CatMD at any time by deleting the App and requesting data deletion. We may suspend or terminate your access if you breach these Terms or if we reasonably believe such action is necessary to comply with law or protect other users.</p>

<h2>12. Governing law and dispute resolution</h2>
<p>These Terms are governed by the laws of <strong>${JURISDICTION}</strong>, without regard to its conflict-of-laws principles. Disputes will be resolved in the courts of the Republic of Singapore, unless you are a consumer resident in another jurisdiction whose mandatory consumer-protection laws grant you rights in your local courts.</p>

<h2>13. Changes to these Terms</h2>
<p>We may revise these Terms from time to time. Material changes will be notified in-app at least 14 days before taking effect. Continued use of the App after that date means you accept the revised Terms.</p>

<h2>14. Contact</h2>
<p>For any question about these Terms, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
`;
  return renderLegalPage('Terms of Service', body);
}

// ── Medical disclaimer ─────────────────────────────────────────────────────

export function renderDisclaimer(): string {
  const body = `
<div class="callout warn">
  <strong>Please read this carefully before using CatMD.</strong>
</div>

<h2>1. CatMD is not a veterinarian</h2>
<p>CatMD is an <strong>informational triage assistant</strong>. It is <strong>not</strong> a licensed veterinary service, and no part of the App &mdash; including its AI output, its knowledge base, its urgency assessments, its health scores, its "differentials", or its "next steps" &mdash; constitutes <strong>veterinary diagnosis, treatment, or advice</strong>.</p>

<h2>2. No veterinarian-client-patient relationship (VCPR)</h2>
<p>Using CatMD does <strong>not</strong> create a veterinarian-client-patient relationship between you (the owner) and CatMD, or between your cat and CatMD. A VCPR, where required by your jurisdiction, must be established with a licensed veterinarian in person.</p>

<h2>3. AI limitations</h2>
<p>CatMD uses artificial intelligence to interpret the information you provide. AI can make mistakes. It can:</p>
<ul>
  <li><strong>Miss serious conditions</strong> that would be obvious to a veterinarian examining your cat in person.</li>
  <li><strong>Flag conditions that aren't present</strong> based on ambiguous symptoms or low-quality photos.</li>
  <li><strong>Produce inconsistent or outdated information.</strong></li>
  <li><strong>Be confident when it should be uncertain.</strong></li>
</ul>
<p>The output is generated from your text input, an optional photo, and a curated feline medical knowledge base. It cannot replace a physical exam, laboratory testing, or imaging.</p>

<h2>4. When to consult a veterinarian</h2>
<p><strong>Always consult a licensed veterinarian for definitive diagnosis and treatment.</strong> CatMD's urgency assessment is <strong>indicative</strong>, not diagnostic. You should contact a veterinarian &mdash; or an emergency animal hospital &mdash; <strong>immediately</strong> if your cat shows any of the following, regardless of what CatMD says:</p>
<ul>
  <li>Difficulty breathing, gasping, or blue/grey gums</li>
  <li>Collapse, unresponsiveness, or seizure</li>
  <li>Inability to urinate, or producing only a few drops</li>
  <li>Blood in urine or stool in more than a trace amount</li>
  <li>Suspected ingestion of a toxic substance (lily, antifreeze, human medication, chocolate, onion/garlic, rat poison, etc.)</li>
  <li>Trauma (hit by vehicle, fall from height, animal attack)</li>
  <li>Severe, continuous vomiting or diarrhoea</li>
  <li>Sudden hind-limb paralysis</li>
</ul>
<p><strong>If in doubt, contact a veterinarian. CatMD should never be the reason you delay veterinary care.</strong></p>

<h2>5. Do not use CatMD for</h2>
<ul>
  <li>Diagnosing non-feline animals. CatMD is specifically trained for cats.</li>
  <li>Prescribing dosages for medications &mdash; <strong>never dose any medication to a cat without explicit veterinary instruction</strong>. Many human medications (paracetamol, ibuprofen, aspirin) are fatal to cats even in tiny doses.</li>
  <li>Making euthanasia or end-of-life decisions. These require hands-on assessment by a licensed veterinarian.</li>
  <li>Replacing routine veterinary care such as vaccinations, parasite prevention, dental cleaning, or spay/neuter.</li>
</ul>

<h2>6. Photos and AI image analysis</h2>
<p>When you attach a photo, it is sent to our AI processing partner for analysis. The analysis is based on what is <strong>visually apparent</strong> in the photo and is subject to lighting, focus, framing, and resolution quality. The App cannot magically detect disease from a photo.</p>

<h2>7. Reliance at your own risk</h2>
<p>Your use of CatMD, and any reliance you place on its output, is <strong>at your own risk</strong>. CatMD and its operators are not responsible for any decision you make based on App output, nor for any harm to you or your cat that results from such a decision.</p>
<p>See the <a href="/terms">Terms of Service</a> for the full limitation of liability.</p>

<h2>8. This disclaimer is always in effect</h2>
<p>This disclaimer applies to <strong>every</strong> output CatMD produces, including free-tier scans, paid-tier scans, litter-box checks, pain-scale scores, follow-up questions, shared PDFs, and any future features. It is referenced from every triage result in the App and must not be removed from any shared output.</p>

<p style="margin-top:28px; font-style:italic;">
  In short: CatMD helps you notice things and ask the right questions. Your vet decides what's actually happening and what to do about it.
</p>
`;
  return renderLegalPage('Medical Disclaimer', body);
}

// ── Account deletion ───────────────────────────────────────────────────────
// Google Play requires a publicly-accessible URL that explains how users
// can delete their account + data. Linked from the Play Store listing.

export function renderDeleteAccount(): string {
  const body = `
<p>CatMD (based in ${JURISDICTION}) gives you two ways to permanently delete your account and the data we hold about you. Both are free and do not require you to contact us for authorisation.</p>

<div class="callout">
  <strong>Recommended: in-app deletion (instant).</strong>
  Open the CatMD app &rarr; <strong>Settings</strong> &rarr; <strong>Forget everything about my cat</strong>. This erases your cats, scans, photos, videos, audio, diary, chat, and health logs from our servers within seconds. No email required.
</div>

<h2>1. In-app deletion (instant)</h2>
<ol>
  <li>Open CatMD on your phone.</li>
  <li>Tap <strong>Settings</strong> (gear icon, bottom of the main screen).</li>
  <li>Scroll to <strong>Data</strong>.</li>
  <li>Tap <strong>Forget everything about my cat</strong>.</li>
  <li>Confirm the prompt. Deletion is immediate and irreversible.</li>
</ol>
<p>This deletes <strong>all</strong> cat-related data (see table below) from our servers and from your device. Your auth record (email, if you added one) remains so you can sign back in later to start fresh. If you also want the auth record deleted, use option 2.</p>

<h2>2. Email-based full-account deletion</h2>
<p>If you cannot access the app, or you also want your email / auth record removed, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> from the email address associated with your CatMD account, with the subject line:</p>
<p><code>Delete my CatMD account</code></p>
<p>Include <strong>one</strong> of the following so we can locate your account:</p>
<ul>
  <li>The email address linked to your CatMD account (if you added one), or</li>
  <li>Your CatMD user ID &mdash; find this in the app under <strong>Settings</strong>, or</li>
  <li>A description that uniquely identifies you (your cat's name plus the approximate date you created the account) if you have no other identifier.</li>
</ul>
<p>We verify ownership, delete your account and all associated data, and confirm by email. We respond within <strong>30 days</strong>; in practice usually within 48 hours.</p>

<h2>3. What is deleted</h2>
<table>
  <thead><tr><th>Data</th><th>Deleted on request?</th><th>How</th></tr></thead>
  <tbody>
    <tr><td>Cat profiles (name, breed, age, weight, conditions, medications, free-text notes)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Scans (text inputs, attached photos, AI scan output)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Body-language readings (uploaded video + AI output)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Meow translations (uploaded audio + AI output)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Photo Studio uploads</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Diary entries (year-long archive)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Chat history with your cat</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Postcards and themed art</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Learned memory items (objects, places, named people, named pets)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Daily check-ins (mood, appetite, water, litter, weight)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Health log entries (vaccinations, medications, weights, appointments, symptom photos, water intake, litter-box use, respiratory rate, pain scores, feeding notes)</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Outcome check-in replies</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Scan-usage counters</td><td><strong>Yes</strong></td><td>Both methods</td></tr>
    <tr><td>Email address + user ID (auth record)</td><td>Only via Option&nbsp;2 (email)</td><td>The in-app option keeps your auth record so you can restart; the email request removes it entirely</td></tr>
  </tbody>
</table>

<h2>4. What is retained after deletion (and why)</h2>
<table>
  <thead><tr><th>Data</th><th>Retention</th><th>Reason</th></tr></thead>
  <tbody>
    <tr><td>Anonymous analytics events (e.g. "scan submitted", "paywall viewed") &mdash; <strong>cannot be linked back to you</strong> after account deletion</td><td>Up to 24 months</td><td>Aggregate product-improvement metrics; no personal identifiers</td></tr>
    <tr><td>Crash reports (if any)</td><td>Up to 90 days</td><td>Bug diagnosis</td></tr>
    <tr><td>Billing records (subscription receipts)</td><td>As required by Google Play and tax law in ${JURISDICTION}</td><td>Legal accounting obligation; handled by Google, not by CatMD directly</td></tr>
    <tr><td>Transactional email logs (e.g. sign-up OTPs)</td><td>Up to 30 days</td><td>Abuse prevention; held by our email provider</td></tr>
  </tbody>
</table>
<p>None of the retained data can be used to re-identify you after deletion.</p>

<h2>5. Subscriptions</h2>
<p>Deleting your account does <strong>not</strong> automatically cancel your Google Play / Apple subscription. Cancel it separately:</p>
<ul>
  <li><strong>Android:</strong> open the Google Play Store &rarr; tap your profile &rarr; Payments &amp; subscriptions &rarr; Subscriptions &rarr; CatMD &rarr; Cancel subscription.</li>
  <li><strong>iOS:</strong> Settings &rarr; [your name] &rarr; Subscriptions &rarr; CatMD &rarr; Cancel.</li>
</ul>
<p>We cannot cancel subscriptions on your behalf &mdash; only Google and Apple can.</p>

<h2>6. Third-party sub-processors</h2>
<p>When you delete your account, we also delete your data from our sub-processors: <strong>Supabase</strong> (database), <strong>PostHog</strong> (analytics profile, if analytics was enabled), <strong>RevenueCat</strong> (subscription profile, if you subscribed), <strong>Sentry</strong> (crash report profile, if enabled). <strong>OpenAI</strong> is sent your photos, videos, audio, and text at the moment of each request to produce a result; per its API data-usage policy, OpenAI does not retain those inputs.</p>

<h2>7. Questions</h2>
<p>For anything not covered here, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. See also the <a href="/privacy">Privacy Policy</a> for the full description of what CatMD collects.</p>
`;
  return renderLegalPage('Delete your CatMD account', body);
}

// ── Referral landing ───────────────────────────────────────────────────────
// Served at /refer/{CODE}. Friend-of-friend install funnel: shared by the
// existing user via native share → recipient sees a branded landing page
// with the Play Store install link + the referrer's code pre-displayed.
// No server-side ledger yet; codes are tracked via PostHog UTM params on
// the install link so we have attribution when we later wire credits via
// RevenueCat.

export function renderReferralLanding(code: string | null): string {
  const safeCode = code && /^[A-Z0-9]{4,12}$/.test(code) ? code : '';
  const playUrl = `https://play.google.com/store/apps/details?id=com.catmd.app${
    safeCode ? `&referrer=${encodeURIComponent('utm_source=referral&utm_campaign=' + safeCode)}` : ''
  }`;
  const body = `
<p>A fellow cat parent thinks you should try <strong>CatMD</strong>.</p>
<p>It's a home-vet that catches things early \u2014 AI triage for symptoms, pain scoring for cats (they hide it), longitudinal health tracking, and a vet-ready PDF report.</p>

${safeCode ? `
<div style="margin:24px 0; padding:16px 20px; background:#FAF7F2; border:1px solid #E6E0D3; border-radius:8px;">
  <div style="font-size:12px; color:#7A7160; text-transform:uppercase; letter-spacing:1px;">Their referral code</div>
  <div style="font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; letter-spacing:4px; color:#1F2024; margin-top:4px;">${escapeHtml(safeCode)}</div>
</div>` : ''}

<a class="cta" href="${playUrl}">Install CatMD (Android)</a>

<p class="muted" style="margin-top:20px;">iOS coming soon. Install link will activate once we're in the App Store.</p>

<div class="callout" style="margin-top:24px;">
  <strong>Why CatMD?</strong>
  <ul>
    <li><strong>Cat-specific AI</strong> — no generic pet chatbot dilution</li>
    <li><strong>Feline Grimace Scale</strong> pain scoring from a single photo</li>
    <li><strong>CKD, thyroid, respiratory rate</strong> dashboards — home monitoring for the diseases that actually kill cats</li>
    <li><strong>Vet-ready PDF</strong> export of your cat's full health history</li>
  </ul>
</div>
`;
  return renderLegalPage('You\u2019re invited to CatMD', body);
}

// ── Legal index ────────────────────────────────────────────────────────────

export function renderLegalIndex(): string {
  const body = `
<p>CatMD is an informational triage assistant for cat parents, based in ${JURISDICTION}.</p>
<ul>
  <li><a href="/privacy">Privacy Policy</a> &mdash; what we collect, how we use it, your rights.</li>
  <li><a href="/terms">Terms of Service</a> &mdash; the agreement between you and CatMD.</li>
  <li><a href="/disclaimer">Medical Disclaimer</a> &mdash; CatMD is not a vet; what that means in practice.</li>
  <li><a href="/delete-account">Delete your account</a> &mdash; how to permanently remove your data.</li>
</ul>
<p class="muted">Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`;
  return renderLegalPage('Legal', body);
}
