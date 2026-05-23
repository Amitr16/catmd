# CatMD — Google Play Store Listing Copy (Japanese / 日本語)

_Source of truth for ja-JP locale. Paste each block into Play Console → Manage translations → Japanese._

_Translation philosophy: Japanese cat-owner culture is unusually warm — uses "愛猫" (aibyou, "beloved cat") not the neutral "猫" in marketing. Tone is gentle and slightly polite (です/ます register) — never the casual だ/である. Honourifics avoided (no さん for the cat — feels childish in this context). Loanwords used freely (トリアージ, ポストカード, ボディランゲージ) — common in modern Japanese pet apps._

_Japan is the #1 cat-volume market globally (cats outnumber dogs since 2017). Japanese cat-content adoption on social is high. The translation register matches: warm + observant + respectful of the cat as a family member._

_Drafted 2026-05-21. Step-by-step upload flow is in `store-listing-copy-es.md` — applies identically; just select Japanese instead of Spanish in step 2._

---

## App title (50 char max)

```
CatMD — 愛猫の心がわかるAI
```
_(17 chars)_

**Alt options:**
- `CatMD：猫オーナーのためのAI` (16) — "AI for cat owners"
- `CatMD — あなたの猫を、解読する` (17) — direct translation of English original
- `CatMD：愛猫専用のAIコンパニオン` (18) — "AI companion just for beloved cats"

---

## Short description (80 char max)

```
愛猫の気分・ボディランゲージ・健康をAIが読み解く。獣医レベルのトリアージも。
```
_(42 chars — Japanese is character-dense)_

**Alt options:**
- `猫オーナー専用のAI — 気分、ボディランゲージ、ポストカード、獣医レベルのトリアージ。` (47)
- `あなたの猫の毎日を、AIが理解する。気分、健康、性格、すべて。` (32)

---

## Full description (4000 char max)

```
CatMD は、猫オーナーのためのAIです。

愛猫のことを知っています — 健康、気分、性格、毎日の生活 — そしてその知識を、あなたが毎日使えるものに変えます。猫専用に作られ、獣医監修の猫医療データで学習されています。

愛猫を知る4つの方法：

🐾 トゥデイ — 15秒の毎日チェックイン。
連続記録、気分、食欲、そしてチェックインのたびに更新されるライブ健康スコア。ボディランゲージリーダーと30日間のHealth Rhythmパターンが、問題になる前の変化を捉えます。

🐾 ボンド — 絆の側面。
• 性格：愛猫の実際の行動から導き出される9つのアーキタイプ
• 毎日のポストカード：写真コラージュにAIが書いたキャプション、シェアの準備完了
• 毎日の日記：午後7時に届く、愛猫自身の声によるプライベートエントリ — 最近の日々、名前のある家族、あなたが愛猫について話したことを参照します
• 人とペット：愛猫の写真に誰が写っているかタグ付け；繰り返し登場する名前は思い出として日記に織り込まれます
• Becoming：7つのファセット（顔、声、体、リズム、家族、性質、記憶）のアイデンティティスコアで、アプリの中で愛猫がどれだけ形作られているかを表示
• ムービーポスター：毎週AI生成のポートレート、テーマがローテーション
• 写真のタイムラプス：愛猫の成長を、月単位で再生

🐾 チャット — 愛猫と話す。
愛猫は一人称で答えます — 性格アーキタイプ独自の声で。日記、写真に写る名前のある人々、あなたが愛猫について話したことを覚えています（「マグロが好き」→ 覚えています）。症状があるときは、愛猫自身の声で診察を頼み — トリアージへ導きます。

🐾 トリアージ — 獣医レベルの症状ガイダンス。
写真+テキストスキャン、緊急度の階層、レッドフラグ、フォローアップの質問。さらに、モントリオール大学（Evangelista et al., 2019）の研究で検証された顔面疼痛スコアリングシステム、フェリーン・グリマス・スケール。ワクチン、体重記録、疾患特異的なモニタリングが、獣医が重視する長期記録を維持します。

なぜCatMDか？
• あなたの愛猫を知っているAI — すべてのインタラクションが、品種、年齢、性格、名前のある家族、最近の日記、あなたが愛猫について話したことを見ています。猫フィルターを付けた汎用ペットアプリではありません。
• 猫専用に設計 — すべての機能が猫の行動、解剖学、リスクパターンに合わせて調整されています。犬による希釈なし。
• 設計によるプライバシー — 写真、日記、セルフファクトはあなたのデバイスに留まります。Proメンバーはクラウドバックアップで、愛猫の履歴がどのデバイスにも付いてきます。
• 危機ツールではなく、毎日の儀式 — ほとんどの日は、チェックインのために、愛猫と話すために、ポストカードをシェアするために、今日のムードを見るためにCatMDを開きます。トリアージは必要なときにそこにあります；ほとんどは必要ありません。

CatMDはAI（GPT-4o、Whisper、gpt-image-1）を使用して写真、行動、音声を解釈します。獣医療の代替ではありません — 緊急時は獣医にすぐ連絡してください。

猫好きが作り、猫医療獣医師と相談して開発。世界中で利用可能。

⚠️ CatMDは情報提供のみです。獣医のアドバイス、診断、治療ではなく、認可された獣医師に代わるものではありません。医療緊急時は、最寄りの救急獣医にすぐ連絡してください。
```

_(approx 1,850 chars — Japanese is compact)_

---

## Release notes (vc 101) — paste into "What's new" ja-JP

```
• 愛猫が時間と共に成熟します。新しい猫は好奇心旺盛で質問を返し、長く知っている猫は親密で観察的になります — 声があなたとの絆と共に成熟していきます。
• チャットのヘッダーをすっきりと。
• 修正：初日に過去の行動を捏造しなくなりました。
• エンゲージメント：初期は小さな好奇心の質問、絆が深まると親密な観察。
```
_(approx 210 chars — well within 500-char limit)_

---

## Screenshot captions (≤80 char each)

### Screenshot 1 — Today

```
毎日のチェックイン、健康スコア、愛猫の気分 — すべて15秒で。
```
_(30 chars)_

### Screenshot 7 — Chat

```
愛猫と話そう。自分自身の声で答え、あなたが伝えたことを覚えています。
```
_(34 chars)_

---

## Key translation notes

- **"愛猫" (aibyou) over "猫" (neko)** — In Japanese cat-owner culture, "愛猫" (literally "beloved cat") is the warm register used in marketing and emotional contexts. "猫" alone is neutral; "愛猫" carries the affection the brand wants.
- **"オーナー" over "飼い主"** — Both mean "owner," but "オーナー" (katakana loanword) is the modern-app register. "飼い主" (kanji) feels more clinical / older.
- **"ボディランゲージ", "ポストカード", "トリアージ"** — Katakana loanwords used directly. These are the established Japanese pet-app vocabulary; native equivalents would feel forced.
- **"です/ます" register throughout** — Polite but not formal. Matches the warm app voice. Avoid keigo (overly formal respect language) — overshoots for app marketing.
- **No cat-pronouns** — Japanese doesn't naturally specify she/he for cats. Just "愛猫" (the cat) carries the subject. Reads cleaner than English.
- **"心がわかるAI" (kokoro ga wakaru AI)** — "AI that understands [your cat's] heart" — emotionally resonant in Japanese marketing. Carries the same warmth as the English "your cat, decoded."
