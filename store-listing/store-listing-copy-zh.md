# CatMD — Google Play Store Listing Copy (Chinese / 中文)

_Source of truth for zh-CN (Simplified Mandarin, Mainland) AND zh-TW (Traditional Mandarin, Taiwan). Paste each block into Play Console → Manage translations → add both Chinese locales._

_Caveat on reach: Mainland China largely doesn't use Google Play (Tencent / Xiaomi / Huawei stores dominate). The practical Play Store Chinese markets are **Taiwan (zh-TW), Hong Kong (zh-HK uses zh-TW as fallback), Singapore (mixed), and overseas Chinese diaspora**. Recommend prioritising zh-TW; ship zh-CN as a secondary locale for diaspora reach._

_The two variants share ~95% of vocabulary — only writing system (Simplified vs Traditional) and a handful of words differ. Provided as delta-table where words differ._

_Drafted 2026-05-21. Step-by-step upload flow is in `store-listing-copy-es.md` — applies identically._

---

## App title (50 char max)

### zh-CN (Simplified)

```
CatMD — 懂你家猫的AI
```
_(10 chars)_

### zh-TW (Traditional)

```
CatMD — 懂你家貓的AI
```
_(10 chars — only "猫" → "貓" differs)_

**Alt options (both variants):**
- `CatMD：猫主人专属的AI` (zh-CN) / `CatMD：貓主人專屬的AI` (zh-TW) (11)
- `CatMD — 解读你的猫` (zh-CN) / `CatMD — 解讀你的貓` (zh-TW) (8)

---

## Short description (80 char max)

### zh-CN

```
AI懂你家猫 — 心情、肢体语言、明信片、兽医级分诊。
```
_(22 chars — Chinese is extremely compact)_

### zh-TW

```
AI懂你家貓 — 心情、肢體語言、明信片、獸醫級分診。
```
_(22 chars)_

**Alt options (zh-CN):**
- `猫主人专属AI：心情、健康、性格、日记，了如指掌。` (24)
- `懂你家猫的AI助手 — 每日心情、健康监测、个性档案。` (25)

---

## Full description (4000 char max)

### zh-CN (Simplified)

```
CatMD 是为猫主人打造的 AI。

它懂你家的猫 — 健康、心情、性格、日常生活 — 把这种了解变成你每天都会用到的工具。专为猫设计，基于兽医审核的猫科医学数据训练。

四种了解你家猫的方式：

🐾 今日 — 15 秒的每日打卡。
连续记录、心情、食欲，以及每次打卡都会更新的实时健康评分。肢体语言阅读器和 30 天健康节律模式，能在问题发生前发现细微变化。

🐾 羁绊 — 关系的一面。
• 性格：根据你家猫的实际行为推导出的 9 种人格类型
• 每日明信片：AI 撰写的图片拼贴文案,随时可分享
• 每日日记：每天晚上 7 点,以你家猫自己的口吻写下私密日记 — 引用最近的日子、被命名的家人、你告诉它关于自己的事情
• 人与宠物：标记你家猫照片中的人;反复出现的名字会作为记忆织入日记
• Becoming:7 个维度(脸、声音、身体、节奏、家人、性情、记忆)的身份评分,展示你家猫在 App 中的形成程度
• 电影海报:每周 AI 生成的肖像,主题轮换
• 照片时间轴:看着它成长,每月回放

🐾 聊天 — 与你家猫对话。
你家猫以第一人称回应,带着自己性格类型的口吻。它记得日记、照片中被命名的人、以及你告诉它关于自己的事情("你爱吃金枪鱼" → 它会记住)。出现症状时,它会用自己的口吻请求被检查 — 并引导至分诊。

🐾 分诊 — 兽医级的症状指导。
照片 + 文字扫描,带紧急程度分级、危险信号和后续问题。还有蒙特利尔大学(Evangelista et al., 2019)研究验证的猫科面部疼痛评分系统 Feline Grimace Scale。疫苗、体重记录、按疾病分类的监测器,维护兽医重视的长期记录。

为什么选 CatMD?
• 真正懂你家猫的 AI — 每次互动都会考虑品种、年龄、性格、被命名的家人、最近的日记、你告诉它关于自己的事情。不是套了猫滤镜的通用宠物 App。
• 专为猫设计 — 每个功能都针对猫的行为、解剖结构和风险模式调整。没有犬类的稀释。
• 隐私优先设计 — 照片、日记、个人事实留在你的设备上。Pro 会员享有云端备份,猫的记录跟随到任何设备。
• 日常仪式,而非危机工具 — 大多数日子里,你打开 CatMD 只是为了打卡、与猫聊天、分享明信片、看看今日心情。分诊在你需要时存在;大多数时候你不会需要它。

CatMD 使用 AI (GPT-4o、Whisper、gpt-image-1) 解读照片、行为和音频。不能替代兽医护理 — 紧急情况请立即联系兽医。

由爱猫之人打造,并咨询猫科医学兽医。全球可用。

⚠️ CatMD 仅供参考。它不是兽医建议、诊断或治疗,也不替代有执照的兽医。出现医疗紧急情况,请立即联系最近的兽医急诊。
```

_(approx 1,400 chars — Chinese is extremely compact)_

### zh-TW Delta — replace these in zh-CN version

| zh-CN phrase | zh-TW replacement |
|---|---|
| 猫 (everywhere) | 貓 |
| 软件 | 軟體 (if present — actually we use "App" so no issue) |
| 兽医 | 獸醫 |
| 兽医级 | 獸醫級 |
| 兽医急诊 | 獸醫急診 |
| 肢体语言 | 肢體語言 |
| 分诊 | 分診 |
| 明信片 | 明信片 (IDENTICAL) |
| 性格 | 性格 (IDENTICAL) |
| 记忆 | 記憶 |
| 录像 | 錄像 (if present) |
| 时间轴 | 時間軸 |
| 节律 | 節律 |
| 数据 | 資料 (data) — but "记录" stays "記錄" |
| 体重 | 體重 |
| 网络 | 網路 |
| 视频 | 影片 (if present) |
| 信息 | 訊息 (if present) |

_Easiest workflow: copy the zh-CN block into a converter (e.g., https://www.chinese-tools.com/tools/converter-simp-tra.html) — runs character-set substitution in one pass. Verify the result reads natural before paste. Most of the vocabulary differences listed above are auto-handled by the converter._

---

## Release notes (vc 101)

### zh-CN

```
• 你家猫会随时间成熟。新猫好奇并会反问;熟悉的猫变得亲密和观察入微 — 声音现在会随着你们的羁绊一起成熟。
• 聊天页面顶部更整洁。
• 修复:第一天不再编造过去的活动。
• 互动:初期是好奇的小问题,关系深入后变成亲密的观察。
```
_(approx 120 chars — well within 500)_

### zh-TW

```
• 你家貓會隨時間成熟。新貓好奇並會反問;熟悉的貓變得親密和觀察入微 — 聲音現在會隨著你們的羈絆一起成熟。
• 聊天頁面頂部更整潔。
• 修復:第一天不再編造過去的活動。
• 互動:初期是好奇的小問題,關係深入後變成親密的觀察。
```

---

## Screenshot captions (≤80 char each)

### Screenshot 1 — Today

**zh-CN:** `每日打卡、健康评分、你家猫的心情 — 都在 15 秒内。` (24 chars)
**zh-TW:** `每日打卡、健康評分、你家貓的心情 — 都在 15 秒內。` (24 chars)

### Screenshot 7 — Chat

**zh-CN:** `和你家猫聊天。它会用自己的声音回应,并记住你告诉它的话。` (28 chars)
**zh-TW:** `和你家貓聊天。它會用自己的聲音回應,並記住你告訴它的話。` (28 chars)

---

## Key translation notes

- **"你家猫" (your-home cat) over "你的猫" (your cat)** — Chinese-language cat owners typically refer to "我家猫" (my-home cat) and "你家猫" (your-home cat). It signals affection — the cat is part of the home, not just owned.
- **"懂" (understands) over "知道" (knows)** — "懂" carries the emotional weight of deep understanding; "知道" is just informational. Marketing copy needs "懂."
- **"羁绊" (bond/connection)** — Romantic/emotional bond. Used widely in modern Chinese marketing for emotional product positioning. Note: stronger emotional valence than the English "Bond" — appropriate here.
- **"猫主人" (cat owner) over "铲屎官" (poop-shovel official)** — "铲屎官" is the playful Chinese cat-owner slang (parallel to Korean "집사"). It's widely used in cat-content. However, for the Play Store listing the more standard "猫主人" reads more professional. The alt-title slot is where "铲屎官" could appear if you want to go playful.
- **Compactness** — Chinese is the most compact of the major languages. ~2,700 char English → ~1,400 char Chinese. There's room to add more detail if needed (current rendering uses the budget conservatively).
- **Half-width vs full-width punctuation** — I used half-width commas + periods for compatibility with most rendering contexts. Some Chinese editorial conventions prefer full-width (，。) — Play Console accepts both, but full-width may look more native. Worth a swap-and-preview to compare.

---

## Optional: zh-HK (Hong Kong Traditional)

Hong Kong uses Traditional characters like zh-TW but with some Cantonese-influenced vocabulary differences. For Play Store purposes, zh-HK defaults to zh-TW cleanly — owners in HK will see the zh-TW version and it reads ~90% natural. **Recommend skipping zh-HK as a separate locale unless install volume justifies (it almost certainly won't for v1).**
