/**
 * PDF export for the "Share with vet" flow. Generates a printable,
 * veterinary-friendly summary of a single scan — cat profile, triage
 * output, questions for the vet, and the sources CatMD cited.
 *
 * Implementation: build an HTML string with embedded CSS, hand it to
 * `expo-print` which renders it to a local PDF file, then open the
 * native share sheet via `expo-sharing`.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { resolveCatAgeMonths, type CatProfile } from '../state/catStore';
import type { ScanRecord } from '../state/scanStore';
import { urgencyTier } from '../theme/tokens';

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replace [ref:Topic] markers with inline superscript citations for the
 * PDF. The accompanying Sources section at the bottom of the card body
 * lists the full topic strings.
 */
function formatInlineCitations(s: string | null | undefined): string {
  if (!s) return '';
  return esc(s).replace(
    /\[ref:([^\]]+)\]/g,
    (_, topic) =>
      ` <sup style="color:#3F6456;font-weight:600;">[${esc(String(topic).split('(')[0]!.trim())}]</sup>`,
  );
}

function ageLabel(cat: CatProfile | null | undefined): string {
  // Always derive from DOB when present — stored age_months is a snapshot
  // and can drift over time.
  const m = resolveCatAgeMonths(cat);
  if (m == null) return '';
  if (m < 12) return `${m} months`;
  const y = m / 12;
  return y < 2 ? `${y.toFixed(1)} years` : `${Math.round(y)} years`;
}

function renderHtml(scan: ScanRecord, cat: CatProfile | null): string {
  const meta = urgencyTier[scan.urgency];
  const tierColor =
    scan.urgency === 'urgent' ? '#8B2F1F'
    : scan.urgency === 'concern' ? '#C97B63'
    : scan.urgency === 'monitor' ? '#B07F28'
    : '#3F6456';

  const created = new Date(scan.created_at);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>CatMD scan report</title>
    <style>
      @page { margin: 24mm 18mm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #1F2024;
        background: #FAF7F2;
        font-size: 11pt;
        line-height: 1.5;
        margin: 0;
      }
      h1, h2, h3 { font-family: 'Georgia', 'Times New Roman', serif; color: #1F2024; }
      h1 { font-size: 24pt; margin: 0 0 2pt; }
      h2 { font-size: 13pt; margin: 18pt 0 6pt; color: #3F6456; text-transform: uppercase; letter-spacing: 1pt; }
      h3 { font-size: 12pt; margin: 8pt 0 4pt; }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        border-bottom: 1pt solid #D0C8B8;
        padding-bottom: 10pt;
        margin-bottom: 14pt;
      }
      .brand { font-size: 10pt; color: #7A7160; letter-spacing: 2pt; text-transform: uppercase; }
      .tier {
        display: inline-block;
        padding: 4pt 10pt;
        border-radius: 99pt;
        font-weight: 600;
        color: white;
        background: ${tierColor};
        font-size: 10pt;
      }
      .card {
        background: #FFFFFF;
        border: 1pt solid #E6E0D3;
        border-radius: 8pt;
        padding: 12pt 14pt;
        margin-bottom: 10pt;
      }
      .muted { color: #7A7160; font-size: 9.5pt; }
      table.kv { width: 100%; border-collapse: collapse; margin-top: 4pt; }
      table.kv td { padding: 2pt 0; vertical-align: top; }
      table.kv td:first-child { width: 35%; color: #7A7160; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5pt; }
      ul { margin: 2pt 0 0 18pt; padding: 0; }
      li { margin: 2pt 0; }
      .score {
        font-family: Georgia, serif;
        font-size: 40pt;
        line-height: 1;
        font-weight: 500;
      }
      .footer {
        margin-top: 24pt;
        padding-top: 8pt;
        border-top: 1pt solid #E6E0D3;
        color: #7A7160;
        font-size: 9pt;
      }
      img.patient {
        width: 100%;
        max-height: 80mm;
        object-fit: cover;
        border-radius: 6pt;
        border: 1pt solid #E6E0D3;
      }
      .citations li { font-size: 10pt; }
      .urgency-banner {
        background: ${tierColor};
        color: white;
        padding: 10pt 14pt;
        border-radius: 6pt;
        font-weight: 600;
        margin-bottom: 12pt;
      }
    </style>
  </head>
  <body>
    <div class="head">
      <div>
        <div class="brand">CatMD — scan report for your veterinarian</div>
        <h1>${esc(scan.headline) || 'Triage summary'}</h1>
        <div class="muted">Generated ${created.toLocaleString()}</div>
      </div>
      <div style="text-align: right;">
        <div class="tier">${meta.label}</div>
        <div class="score">${Math.round(scan.score)}<span style="font-size: 14pt; color: #7A7160;">/100</span></div>
        <div class="muted">Health score</div>
      </div>
    </div>

    ${scan.urgency === 'urgent' ? `
      <div class="urgency-banner">
        CatMD flagged this as URGENT. Please contact your emergency vet immediately.
      </div>` : ''}

    ${scan.image_uri ? `
      <img class="patient" src="${esc(scan.image_uri)}" alt="Photo included with scan" />
    ` : ''}

    <h2>Patient</h2>
    <div class="card">
      <table class="kv">
        <tr><td>Name</td><td>${esc(cat?.name ?? 'Unknown')}</td></tr>
        <tr><td>Breed</td><td>${esc(cat?.breed ?? '—')}</td></tr>
        <tr><td>Age</td><td>${esc(ageLabel(cat)) || '—'}</td></tr>
        <tr><td>Weight</td><td>${cat?.weight_kg ? `${cat.weight_kg} kg` : '—'}</td></tr>
        <tr><td>Sex</td><td>${esc(cat?.sex ?? '—')}${cat?.spayed_neutered ? ' (spayed/neutered)' : ''}</td></tr>
        <tr><td>Lifestyle</td><td>${esc(cat?.indoor_outdoor ?? '—')}</td></tr>
        <tr><td>Known conditions</td><td>${(cat?.conditions ?? []).map(esc).join(', ') || '—'}</td></tr>
        <tr><td>Current medications</td><td>${(cat?.medications ?? []).map(esc).join(', ') || '—'}</td></tr>
      </table>
    </div>

    <h2>What the owner described</h2>
    <div class="card">
      ${esc(scan.user_input).split('\n').map(p => `<p>${p}</p>`).join('') || '<p class="muted">(no text provided)</p>'}
    </div>

    <h2>CatMD assessment</h2>
    <div class="card">
      <p>${formatInlineCitations(scan.explanation)}</p>
      ${scan.photo_observations ? `
        <h3>Photo observations</h3>
        <p>${esc(scan.photo_observations)}</p>
      ` : ''}
      ${scan.red_flags.length > 0 ? `
        <h3 style="color: #8B2F1F">Red flags</h3>
        <ul>${scan.red_flags.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      ` : ''}
    </div>

    ${scan.differentials.length > 0 ? `
      <h2>Differential diagnosis (what this could be)</h2>
      ${scan.differentials.map(d => `
        <div class="card">
          <h3>${esc(d.condition)} <span style="color: #7A7160; font-size: 10pt;">— ${esc(d.likelihood)}</span></h3>
          ${d.reasoning ? `<p>${formatInlineCitations(d.reasoning)}</p>` : ''}
          ${d.supporting_signs.length > 0 ? `
            <p><b>Supports this:</b></p>
            <ul>${d.supporting_signs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          ` : ''}
          ${d.against_signs.length > 0 ? `
            <p><b>Against this:</b></p>
            <ul>${d.against_signs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          ` : ''}
        </div>
      `).join('')}
    ` : ''}

    ${scan.reassurances.length > 0 ? `
      <h2>Reassurances</h2>
      <div class="card">
        <ul>${scan.reassurances.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${scan.home_checks.length > 0 ? `
      <h2>What the owner has checked at home</h2>
      <div class="card">
        <ol>${scan.home_checks.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
      </div>
    ` : ''}

    ${scan.what_to_monitor.length > 0 ? `
      <h2>Being monitored</h2>
      <div class="card">
        <ul>${scan.what_to_monitor.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${scan.next_steps.length > 0 ? `
      <h2>Owner's decision guide</h2>
      <div class="card">
        ${scan.next_steps.map(n => `
          <p><b>When:</b> ${esc(n.when)}<br /><b>Do:</b> ${esc(n.action)}</p>
        `).join('')}
      </div>
    ` : ''}

    ${scan.vet_questions.length > 0 ? `
      <h2>Questions for the vet</h2>
      <div class="card">
        <ol>
          ${scan.vet_questions.map(q => `<li>${esc(q)}</li>`).join('')}
        </ol>
      </div>
    ` : ''}

    ${scan.vet_preparations.length > 0 ? `
      <h2>Bringing to the vet</h2>
      <div class="card">
        <ul>
          ${scan.vet_preparations.map(p => `<li>${esc(p)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${scan.citation_topics.length > 0 ? `
      <h2>Sources CatMD consulted</h2>
      <div class="card citations">
        <ul>${scan.citation_topics.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    <div class="footer">
      This is an AI-generated triage summary from CatMD. It is informational only and is
      not a substitute for professional veterinary diagnosis or treatment. It is intended
      to help an owner describe the problem more completely to a licensed veterinarian.
    </div>
  </body>
</html>`;
}

/**
 * Render a scan as PDF, then hand it to the share sheet.
 * Returns the generated file URI in case the caller wants to reuse it.
 */
export async function shareScanAsPdf(
  scan: ScanRecord,
  cat: CatProfile | null,
): Promise<string | null> {
  try {
    const html = renderHtml(scan, cat);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        dialogTitle: `${cat?.name ?? 'Cat'} — CatMD scan for vet`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    }
    return uri;
  } catch (e) {
    console.warn('[CatMD] shareScanAsPdf:', e);
    return null;
  }
}

// ── 12-month health summary PDF ────────────────────────────────────────────

type SummaryStatsLite = {
  scans: {
    total: number;
    byUrgency: { urgent: number; concern: number; monitor: number; routine: number };
    worstHeadline: string | null;
  };
  weight: {
    points: { ts: string; kg: number }[];
    latestKg: number | null;
    latestBcs: number | null;
    deltaKg: number | null;
  };
  vaccinations: {
    list: { vaccine: string; given_on: string; next_due: string | null }[];
  };
  medications: {
    perMed: { medication: string; doses: number; lastAt: string }[];
  };
  appointments: {
    upcoming: { title: string; scheduled_for: string; vet: string | null; reason: string | null }[];
    completed: { title: string; scheduled_for: string; vet: string | null; outcome_notes: string | null }[];
  };
  symptoms: {
    concerns: { slug: string; label: string; photos: number; firstAt: string; lastAt: string }[];
  };
  outcome: { total: number; better: number; same: number; worse: number };
};

function fmtD(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return esc(iso); }
}

function renderSummaryHtml(
  cat: CatProfile,
  stats: SummaryStatsLite,
  windowDays: number,
): string {
  const generated = new Date();
  const ageLbl = ageLabel(cat);

  const u = stats.scans.byUrgency;

  const vacciRows = stats.vaccinations.list.map((v) => `
    <tr>
      <td>${esc(v.vaccine)}</td>
      <td>${fmtD(v.given_on)}</td>
      <td>${v.next_due ? fmtD(v.next_due) : '—'}</td>
    </tr>
  `).join('');

  const medRows = stats.medications.perMed.map((m) => `
    <tr>
      <td>${esc(m.medication)}</td>
      <td>${m.doses}</td>
      <td>${fmtD(m.lastAt)}</td>
    </tr>
  `).join('');

  const apptRows = [
    ...stats.appointments.upcoming.map((a) => `
      <tr>
        <td>${fmtD(a.scheduled_for)}</td>
        <td>Upcoming</td>
        <td>${esc(a.title)}${a.vet ? ` · ${esc(a.vet)}` : ''}${a.reason ? `<br/><span class="muted">${esc(a.reason)}</span>` : ''}</td>
      </tr>
    `),
    ...stats.appointments.completed.slice(0, 8).map((a) => `
      <tr>
        <td>${fmtD(a.scheduled_for)}</td>
        <td>Completed</td>
        <td>${esc(a.title)}${a.vet ? ` · ${esc(a.vet)}` : ''}${a.outcome_notes ? `<br/><span class="muted">${esc(a.outcome_notes)}</span>` : ''}</td>
      </tr>
    `),
  ].join('');

  const concernRows = stats.symptoms.concerns.map((c) => `
    <tr>
      <td>${esc(c.label)}</td>
      <td>${c.photos}</td>
      <td>${fmtD(c.firstAt)} → ${fmtD(c.lastAt)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>CatMD — 12-month report</title>
<style>
  @page { margin: 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2024; background: #FAF7F2; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  h1, h2, h3 { font-family: 'Georgia', 'Times New Roman', serif; color: #1F2024; }
  h1 { font-size: 22pt; margin: 0 0 2pt; }
  h2 { font-size: 11.5pt; margin: 14pt 0 6pt; color: #3F6456; text-transform: uppercase; letter-spacing: 1pt; }
  .brand { font-size: 9pt; color: #7A7160; letter-spacing: 2pt; text-transform: uppercase; }
  .head { border-bottom: 1pt solid #D0C8B8; padding-bottom: 10pt; margin-bottom: 14pt; }
  .muted { color: #7A7160; }
  .card { background: #FFFFFF; border: 1pt solid #E6E0D3; border-radius: 8pt; padding: 10pt 12pt; margin-bottom: 8pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 4pt; }
  table td, table th { padding: 3pt 6pt; vertical-align: top; text-align: left; font-size: 10pt; }
  table thead th { color: #7A7160; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.5pt; border-bottom: 0.5pt solid #E6E0D3; }
  table tbody tr:nth-child(even) { background: #FAF7F2; }
  .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 18pt; }
  .kv div { display: flex; justify-content: space-between; border-bottom: 0.5pt solid #E6E0D3; padding: 3pt 0; }
  .kv div span:first-child { color: #7A7160; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5pt; }
  .footer { margin-top: 24pt; padding-top: 8pt; border-top: 1pt solid #E6E0D3; color: #7A7160; font-size: 8.5pt; }
</style></head><body>
  <div class="head">
    <div class="brand">CatMD — 12-month health report</div>
    <h1>${esc(cat.name)}</h1>
    <div class="muted">
      ${ageLbl ? `${ageLbl} · ` : ''}${esc(cat.breed ?? 'Mixed')}
      ${cat.sex !== 'unknown' ? ` · ${esc(cat.sex)}` : ''}
      ${cat.indoor_outdoor ? ` · ${esc(cat.indoor_outdoor)}` : ''}
      · Report window: last ${windowDays} days · Generated ${generated.toLocaleString()}
    </div>
  </div>

  <h2>At a glance</h2>
  <div class="card">
    <div class="kv">
      <div><span>Scans run</span><span>${stats.scans.total}</span></div>
      <div><span>Urgent / concern / monitor / routine</span><span>${u.urgent} / ${u.concern} / ${u.monitor} / ${u.routine}</span></div>
      <div><span>Latest weight</span><span>${stats.weight.latestKg != null ? stats.weight.latestKg.toFixed(2) + ' kg' : '—'}</span></div>
      <div><span>Weight change</span><span>${stats.weight.deltaKg != null ? (stats.weight.deltaKg >= 0 ? '+' : '') + stats.weight.deltaKg.toFixed(2) + ' kg' : '—'}</span></div>
      <div><span>Vaccinations on file</span><span>${stats.vaccinations.list.length}</span></div>
      <div><span>Medications tracked</span><span>${stats.medications.perMed.length}</span></div>
      <div><span>Vet visits (done / upcoming)</span><span>${stats.appointments.completed.length} / ${stats.appointments.upcoming.length}</span></div>
      <div><span>Outcome check-ins</span><span>${stats.outcome.total} (${stats.outcome.better}↑ ${stats.outcome.same}→ ${stats.outcome.worse}↓)</span></div>
    </div>
    ${stats.scans.worstHeadline ? `<p class="muted" style="margin-top:8pt;">Most urgent headline: <strong>${esc(stats.scans.worstHeadline)}</strong></p>` : ''}
  </div>

  <h2>Vaccinations</h2>
  <div class="card">
    ${vacciRows ? `<table>
      <thead><tr><th>Vaccine</th><th>Given</th><th>Next due</th></tr></thead>
      <tbody>${vacciRows}</tbody>
    </table>` : '<p class="muted">None logged.</p>'}
  </div>

  <h2>Medications</h2>
  <div class="card">
    ${medRows ? `<table>
      <thead><tr><th>Medication</th><th>Doses</th><th>Last given</th></tr></thead>
      <tbody>${medRows}</tbody>
    </table>` : '<p class="muted">None logged.</p>'}
  </div>

  <h2>Vet visits</h2>
  <div class="card">
    ${apptRows ? `<table>
      <thead><tr><th>Date</th><th>Status</th><th>Details</th></tr></thead>
      <tbody>${apptRows}</tbody>
    </table>` : '<p class="muted">None logged.</p>'}
  </div>

  <h2>Symptom concerns tracked</h2>
  <div class="card">
    ${concernRows ? `<table>
      <thead><tr><th>Concern</th><th>Photos</th><th>Period</th></tr></thead>
      <tbody>${concernRows}</tbody>
    </table>` : '<p class="muted">None tracked.</p>'}
  </div>

  <div class="footer">
    CatMD informational summary — not veterinary advice. Discuss any concerns with a licensed veterinarian.
  </div>
</body></html>`;
}

export async function shareHealthSummaryAsPdf(opts: {
  cat: CatProfile;
  stats: SummaryStatsLite;
  windowDays: number;
}): Promise<string | null> {
  try {
    const html = renderSummaryHtml(opts.cat, opts.stats, opts.windowDays);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        dialogTitle: `${opts.cat.name} — 12-month health report`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    }
    return uri;
  } catch (e) {
    console.warn('[CatMD] shareHealthSummaryAsPdf:', e);
    return null;
  }
}
