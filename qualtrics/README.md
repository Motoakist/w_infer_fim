# Qualtrics 実装ガイド — NeurIPS2026 実験

本フォルダの `main.html` / `main.js` を Qualtrics の **1 つの Question** に貼り付け、**練習試行 2 回 + 本試行 6 回**のみを実行します。

> **以下のブロックは別 Question で実装する想定**で、本 Question からは削除されています：
> - 「実験の概要」（前段）
> - 「美咲について（θ 教示）」（前段）
> - 「w 推定」（後段）
> - 「事後質問（難易度・戦略・注意確認）」（後段）
> - 「デブリーフィング」（後段）
>
> 本試行 6 回が終わると、main.js が Embedded Data を書き出して `clickNextButton()` で次の Qualtrics Question に自動遷移します。

### 推奨される Survey Flow 構成

```
[Block: 概要説明]
  └─ Question 1: 実験の概要(テキスト)
  └─ Question 2: 美咲について(θ 条件に応じた性格紹介, Display Logic で出し分け)

[Block: 主実験]
  └─ Question 3: 本フォルダの main.html + main.js (練習 2 + 本試行 6 のみ)

[Block: 推定・事後]
  └─ Question 4: 美咲の各論点重視度を推定(w 推定, Qualtrics Slider)
  └─ Question 5: 事後質問(難易度・戦略・注意確認)
  └─ Question 6: デブリーフィング(終了画面)
```

Question 2 は θ の 4 水準それぞれ用に Display Logic を設定するか、Embedded Data の `cond_theta` を使った Piped Text で同一 Question 内に出し分けると良いです。

---

## 1. Qualtrics 上で定義する Embedded Data 変数

### 1.1 入力変数（Survey Flow → JS）

実験開始前に **Survey Flow → Set Embedded Data** で定義してください。

#### 条件変数

| 変数名 | 型 | 例 / 取りうる値 | 説明 |
|---|---|---|---|
| `cond_theta` | string | `competitive` / `individualistic` / `cooperative` / `altruistic` | SVO 条件（θ の 4 水準）|
| `cond_tau` | string | `moderate` / `extreme` | τ 位置の 2 水準 |
| `cond_seq` | string | `optimal` / `random` | 観測系列の 2 水準 |

→ Randomizer で **4 × 2 × 2 = 16 セル**を均等割付。

#### 重みベクトル（推定対象 / 参加者選好）

| 変数名 | 型 | 例 | 説明 |
|---|---|---|---|
| `w_self` | string | `1,-2,-1` | カンマ区切り 3 値（推定対象, 参加者には不可視） |
| `w_other` | string | `0,-1,2` | カンマ区切り 3 値（参加者の選好, 教示で表示） |
| `extreme_ratio` | string | `0.8` | extreme 条件の r 値（任意, 既定 0.8）|

#### 刺激（画像 URL）

| 変数名 | 型 | 例 | 説明 |
|---|---|---|---|
| `issue1_img` | string | `https://.../item1.png` | アイテム 1 画像 URL |
| `issue2_img` | string | `https://.../item2.png` | アイテム 2 画像 URL |
| `issue3_img` | string | `https://.../item3.png` | アイテム 3 画像 URL |

→ 画像は Qualtrics の Library にアップロードして Graphic URL を貼り付け、または独自 CDN を使用。
former_exp.js と同じ命名（`issue{1,2,3}_img`）にしてあります。

> **提案ボタン画像**は `main.js` 内に Qualtrics Graphic URL を直接ハードコード（former_exp.js と同様）。差し替えが必要なら `main.js` の `PROPOSE_BTN_IMG` を編集してください。

---

### 1.2 出力変数（JS → Qualtrics）

JS が `Qualtrics.SurveyEngine.setEmbeddedData()` で書き込む変数です。**Survey Flow で事前に空文字で定義**しておく必要があります（Qualtrics の制約）。

> **w 推定（参加者の推定値）は別 Question** で実装するため、本 Question の出力には含まれません。
> 真値との比較指標（`cosine_distance`, `mse_w1〜3` 等）は解析段階で計算してください。

#### 試行ログ（trial 1〜6 の各々について保存）

##### 推薦・提案・表情

| 変数名（i = 1..6） | 型 | 例 | 説明 |
|---|---|---|---|
| `trial{i}_recommendation` | string | `3,2,1` | 提示された推薦配分 |
| `trial{i}_proposal` | string | `3,2,1` | **提案ボタン押下時**の配分（CSV）|
| `trial{i}_offer_issue1` | int | `3` | 提案配分の論点 1（美咲側枚数）|
| `trial{i}_offer_issue2` | int | `2` | 提案配分の論点 2 |
| `trial{i}_offer_issue3` | int | `1` | 提案配分の論点 3 |
| `trial{i}_expression` | string | `J1` | 美咲が示した表情ラベル |
| `trial{i}_match_recommendation` | int | `1` | 最終配分が推薦値と一致なら 1, 不一致なら 0 |

> `trial{i}_proposal` / `trial{i}_offer_issue*` / `trial{i}_expression` は **`onPropose()` 時点で即時保存**＋事後確定時に再保存（途中離脱対策）。

##### タイミング

| 変数名（i = 1..6） | 型 | 例 | 説明 |
|---|---|---|---|
| `trial{i}_propose_time_ms` | float | `4521.0` | 試行開始 → 提案ボタン押下までの時間 |
| `trial{i}_proposed_at_ms` | float | `4521.0` | 提案ボタン押下のタイムスタンプ（試行開始基準, 即時保存）|
| `trial{i}_view_time_ms` | float | `5034.5` | 提案 → 「次へ」までの時間（表情視聴時間）|

##### スライダー操作履歴 (former_exp.js 互換)

| 変数名（i = 1..6） | 型 | 例 | 説明 |
|---|---|---|---|
| `trial{i}_slider_changes` | string | `2,3,1` | 各論点のスライダー操作回数（CSV）|
| `trial{i}_slider1_changes_n` | int | `2` | 論点 1 の操作回数 |
| `trial{i}_slider2_changes_n` | int | `3` | 論点 2 の操作回数 |
| `trial{i}_slider3_changes_n` | int | `1` | 論点 3 の操作回数 |
| `trial{i}_pos_issue1` | string | `0,1,3,` | 論点 1 のスライダー値の遷移（初期値 + 各操作後の値, CSV, 末尾カンマあり）|
| `trial{i}_pos_issue2` | string | `0,2,3,1,` | 論点 2 同様 |
| `trial{i}_pos_issue3` | string | `0,2,` | 論点 3 同様 |
| `trial{i}_time_issue1` | string | `1.234,3.456,` | 論点 1 の各操作のタイムスタンプ（試行開始からの秒数, 小数 3 桁, CSV）|
| `trial{i}_time_issue2` | string | `0.567,1.890,` | 論点 2 同様 |
| `trial{i}_time_issue3` | string | `2.012,` | 論点 3 同様 |
| `trial{i}_positions_history` | string (JSON) | `[[0,0,0],[1,0,0],[1,2,0],…]` | 全 3 スライダーのスナップショット履歴 |

#### 条件パラメータ（解析用）

| 変数名 | 型 | 説明 |
|---|---|---|
| `theta_deg` | float | θ の度数（-45 / 0 / 45 / 90）|
| `c_value` | float | 評価基準点 c |
| `delta_plus` | float | Δ_+ |
| `delta_minus` | float | Δ_- |
| `tau_thresholds` | string | `τ_-3, τ_-2, τ_-1, τ_0, τ_+1, τ_+2`（カンマ区切り）|
| `u_max_beta` | float | smooth max（β=10）|
| `u_min_beta` | float | smooth min（β=10）|

#### 補助指標

| 変数名 | 型 | 例 | 説明 |
|---|---|---|---|
| `noncompliance_rate` | float | `0.0` | 推薦値非遵守の試行割合 |

> 事後質問関連 (`difficulty_rating`, `strategy_text`, `attention_check`, `attention_pass`) は別 Question で取得します。

#### タイミング

| 変数名 | 型 | 説明 |
|---|---|---|
| `total_task_time_ms` | float | 教示〜デブリーフィング送信までの総時間 |
| `started_at_iso` | string | 開始時刻（ISO 8601）|
| `finished_at_iso` | string | 終了時刻（ISO 8601）|

---

## 2. Survey Flow セットアップ手順

### Step 1: Embedded Data の宣言

```
[Set Embedded Data] (実験 Question の前に配置)
  ┌─ 入力変数 ─
  │ cond_theta = （Randomizer で割付）
  │ cond_tau   = （Randomizer で割付）
  │ cond_seq   = （Randomizer で割付）
  │ w_self     = "1,-2,-1"
  │ w_other    = "0,-1,2"
  │ extreme_ratio = "0.8"
  │ issue1_img = "https://.../item1.png"
  │ issue2_img = "https://.../item2.png"
  │ issue3_img = "https://.../item3.png"
  │
  └─ 出力変数（空で宣言, JS が後で書く）─
    trial1_recommendation, trial1_proposal, trial1_expression,
    trial1_propose_time_ms, trial1_view_time_ms,
    trial1_slider_changes, trial1_match_recommendation,
    ... (trial2 〜 trial6 同様) ...
    theta_deg, c_value, delta_plus, delta_minus,
    tau_thresholds, u_max_beta, u_min_beta,
    difficulty_rating, strategy_text,
    attention_check, attention_pass, noncompliance_rate,
    total_task_time_ms, started_at_iso, finished_at_iso
```

### Step 2: 16 条件 Randomizer

```
[Randomizer: Evenly Present Elements (cond_theta)]
  ├─ Set Embedded Data: cond_theta = competitive
  ├─ Set Embedded Data: cond_theta = individualistic
  ├─ Set Embedded Data: cond_theta = cooperative
  └─ Set Embedded Data: cond_theta = altruistic

[Randomizer: Evenly Present Elements (cond_tau)]
  ├─ Set Embedded Data: cond_tau = moderate
  └─ Set Embedded Data: cond_tau = extreme

[Randomizer: Evenly Present Elements (cond_seq)]
  ├─ Set Embedded Data: cond_seq = optimal
  └─ Set Embedded Data: cond_seq = random
```

### Step 3: Question の作成

1. 新しい Question を作成（Type: **Text/Graphic**）
2. **Question Text** に `main.html` の中身を貼り付け
3. **Question JavaScript** に `main.js` の中身を貼り付け

→ Survey Flow 上では「Block: 主実験」内の単一 Question として配置。

---

## 3. ファイル構成

```
qualtrics/
├─ README.md          このファイル
├─ main.html          Qualtrics Question Body に貼る HTML
└─ main.js            Qualtrics Question JavaScript に貼る JS
```

`main.html` と `main.js` は self-contained で、外部 CSS/JS ファイルへの依存なし（CDN 経由のライブラリは除く）。

---

## 4. 動作確認チェックリスト

Qualtrics でプレビュー時に以下を確認：

- [ ] 教示画面が表示される
- [ ] θ 教示画面で `cond_theta` に応じた性格紹介が表示される
- [ ] 練習試行 2 回が動作する（Live2D の表情切替を確認）
- [ ] 本試行 6 回が動作する（推薦配分が条件に応じて変化）
- [ ] 提案ボタン → 表情更新 → 5 秒タイマー → 次へ の流れがスムーズ
- [ ] w 推定で 3 つのスライダーが操作できる
- [ ] 事後質問が表示される
- [ ] 全完了で Qualtrics の次の Question に自動遷移
- [ ] DevTools Console で `Live2D init: OK` のログが出る
- [ ] Embedded Data に出力変数が書き込まれている（プレビューモードでは Survey Flow 末端でデバッグ表示可能）

---

## 5. ローカル版 (`exp/index.html`) との対応

| ローカル版（`exp/`） | Qualtrics 版（`qualtrics/`） |
|---|---|
| URL クエリ `?theta=...&tau=...&seq=...&w_self=...&w_other=...&pid=...` | Embedded Data の `cond_theta`, `cond_tau`, `cond_seq`, `w_self`, `w_other` |
| `localStorage.neurips2026_full` に保存 | `Qualtrics.SurveyEngine.setEmbeddedData()` で 1 変数ずつ保存 |
| stimuli/item{1,2,3}.png をローカルファイルから読込 | Qualtrics Library Graphic URL（`item{i}_img`）|
| 提案ボタン画像を直接 URL 指定 | Embedded Data の `propose_btn_*` で差替可能 |

ロジック自体（θ/τ/τ閾値の計算、累積リンク表情判定、6 試行ループ）は共通。
