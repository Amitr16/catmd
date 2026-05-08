# Build an installable APK with EAS

Produces a signed preview APK you can sideload onto any Android phone
for testing. Takes ~25 minutes end-to-end (first run), ~15 min after.

## 0. What's in `eas.json`

| Profile | When to use | Output |
|---|---|---|
| `development` | Running a dev-client build to get full native modules in dev | `.apk` debug |
| `preview` | **What we want right now** — a shareable signed APK for dogfooding | `.apk` release |
| `production` | Play Store submission | `.aab` app bundle |

---

## 1. One-time setup

```powershell
cd D:\apps\catmd
npm install -g eas-cli
eas login             # use amit1601 (same Expo account as Folio)
```

Link the project to its owner. This writes an `extra.eas.projectId` into
`app.json` if it's not already set.

```powershell
eas init
```

The first time you build Android with EAS, it will offer to generate a
release keystore for you. Accept — EAS stores it securely on Expo's
servers and uses the same keystore on every subsequent build. Losing
the keystore means Play Store no longer accepts updates, so EAS-managed
is the right default.

---

## 2. Build the APK

```powershell
eas build --profile preview --platform android
```

You'll see a queue position and a URL like
`https://expo.dev/accounts/amit1601/projects/catmd/builds/<uuid>`.

Progress through Metro → Gradle → Sign → Upload, ~15 min total.
When done, EAS prints a direct `.apk` download URL.

---

## 3. Install on your phone

### Option A — Scan the QR code EAS shows on the success page
Your phone must have "install from unknown sources" enabled for your
browser / file manager.

### Option B — Direct download
Visit the URL on your phone's browser, download, tap the file, confirm
install.

### Option C — adb (USB)
```powershell
adb install -r path/to/catmd.apk
```

---

## 4. Share with beta testers

The EAS build page has an "Install" button; anyone you share the link
with can download. No Play Store required. Up to ~100 testers via this
route before you switch to Play Store's closed-testing track.

Remind testers to:
- Enable "install from unknown sources" once.
- Grant Camera + Photos permissions on first use.
- Sign up with an email if they want their history to survive reinstall.

---

## 5. Iterate

Make changes locally → push to `preview` branch or just run again:

```powershell
eas build --profile preview --platform android
```

Each build gets a fresh URL. Old APKs keep working but will show an
"update available" hint once you enable OTA updates (deferred — we're
not using `expo-updates` in preview builds).

---

## 6. When ready for Play Store

```powershell
# Produces a signed .aab for Play Store upload
eas build --profile production --platform android

# Once you've uploaded + passed closed testing for 14 days:
eas submit --profile production --platform android
```

`eas.json` is pre-configured to submit to the Play Console internal
track as a draft — you manually promote to production from the
Play Console UI.

---

## 7. Troubleshooting

- **"Gradle build failed"** — usually a native-module version drift.
  Run `npx expo install --check` locally, fix mismatches, retry.
- **"Keystore missing"** — run `eas credentials` to regenerate /
  re-upload.
- **"No experience found"** — run `eas init` to link the project.
- **Build times out at queue** — free tier has 30 builds/month and 10
  min queue cap; wait or upgrade. Usually it clears in 2–5 min.

---

## 8. Before your first preview build — checklist

- [ ] `.env` has a working OpenAI key **OR** `EXPO_PUBLIC_AI_BASE_URL`
      pointing at your deployed Cloudflare Worker (see `proxy/README.md`)
- [ ] Supabase project is live + schema loaded (knowledge_cards +
      schema-users.sql)
- [ ] Anonymous auth is enabled in Supabase (Authentication → Providers)
- [ ] Legal docs are drafted in `docs/legal/` (they don't need to be
      hosted yet for preview — Play Store production does require them)
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Expo Doctor passes: `npx expo-doctor`
