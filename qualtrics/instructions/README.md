# タスク事前説明 — Qualtrics 用ファイル

このフォルダには **2 つのバージョン**があります。Qualtrics の Block 設計に応じて使い分けてください。

| バージョン | ファイル | 特徴 |
|---|---|---|
| **個別ページ版** | `01_purpose.html` 〜 `09_attention.html`（各 Question） | 1 ページごとに Qualtrics Question を分ける。Qualtrics 標準の「次へ」が使える |
| **統合版** | `combined.html` + `combined.js`（1 Question） | 01〜08 を 1 つにまとめる。**「戻る」ボタンで前のページに戻れる**。最後の理解度チェックで全問正解 → 次の Question |

### どちらを使うか

- **戻れない方が良い**（参加者を脱線させたくない）→ 個別ページ版
- **戻れた方が良い**（理解度チェックで詰まった人が説明を読み直せる）→ 統合版

統合版を使う場合、`09_attention.html` (事前注意確認) は **別 Question** として残してください。

---

## 1. ファイル一覧と Qualtrics 設定

| # | ファイル | Qualtrics 設定 | JS 必要 |
|---|---|---|---|
| 1 | `01_purpose.html` | Text/Graphic Question | ❌ |
| 2 | `02_misaki.html` | Text/Graphic Question | ❌ |
| 3 | `03_items.html` | Text/Graphic Question | ❌ (Piped Text のみ) |
| 4 | `04_expression.html` | Text/Graphic Question | ❌ |
| 5 | `05_flow.html` | Text/Graphic Question | ❌ |
| 6 | `06_ui.html` | Text/Graphic Question | ❌ |
| 7 | `07_theta.html` + `07_theta.js` | Text/Graphic Question | ✅ |
| 8 | `08_comprehension.html` + `08_comprehension.js` | Text/Graphic Question | ✅ |
| 9 | `09_attention.html` + `09_attention.js` | Text/Graphic Question | ✅ |

各ファイルは:
- **HTML**: Qualtrics の **Question Text の HTML View** に貼り付け
- **JS**: Qualtrics の **Question JavaScript** パネルに貼り付け

---

## 2. Survey Flow 構成

### 2A. 個別ページ版を使う場合

```
[Block: 事前説明]
  Q1. 01_purpose.html        (Qualtrics 標準「次へ」)
  Q2. 02_misaki.html         (Qualtrics 標準「次へ」)
  Q3. 03_items.html          (Qualtrics 標準「次へ」)
  Q4. 04_expression.html     (Qualtrics 標準「次へ」)
  Q5. 05_flow.html           (Qualtrics 標準「次へ」)
  Q6. 06_ui.html             (Qualtrics 標準「次へ」)
  Q7. 07_theta.html + .js    (Qualtrics 標準「次へ」)
  Q8. 08_comprehension.html + .js  (JS が自動で「次へ」)
  Q9. 09_attention.html + .js      (JS が自動で「次へ」)

[Block: 主実験]
  Q10. main.html + main.js   (JS が自動で「次へ」)

[Block: 推定・事後]
  Q11. 美咲の重み推定 (Qualtrics Slider question)
  Q12. 事後質問 + デブリーフィング
```

### 2B. 統合版を使う場合 (推奨: 戻れる)

```
[Block: 事前説明]
  Q1. combined.html + combined.js
       └─ 内部で 8 ブロック (purpose → misaki → items → expression
                            → flow → ui → theta → comprehension)
       └─ 各ブロックに「戻る」「次へ」ボタンあり
       └─ 全問正解で JS が自動で「次へ」(主実験へ)
  Q2. 09_attention.html + 09_attention.js  (事前注意確認は分離)

[Block: 主実験]
  Q3. main.html + main.js

[Block: 推定・事後]
  Q4. 美咲の重み推定
  Q5. 事後質問 + デブリーフィング
```

→ 統合版のほうが **Qualtrics Question 数が少なくて管理しやすい**かつ **参加者が説明を読み直せる**ので推奨。

---

## 3. 各ファイルの役割

### 3.1 `01_purpose.html` — タスクの目的
観察 → 表情 → w 推定パラダイムの大原則を伝える。
「正解の配分なし」「勝ち負けなし」を強調。

### 3.2 `02_misaki.html` — 美咲の紹介
美咲は AI エージェントで、表情で気持ちを表現することを示す。
7 段階の表情を絵文字で例示。
**Qualtrics Library に美咲の静止画をアップロード** して、
`<div class="nip-figure-placeholder">` を `<img src="...">` に差し替え推奨。

### 3.3 `03_items.html` — アイテムと配分
3 種類 × 5 個のアイテム構成、5 段階の好み (-2〜+2) を説明。
アイテム画像は **`${e://Field/issue1_img}` 等で Qualtrics の Piped Text** で取得（JS 不要）。

### 3.4 `04_expression.html` — 表情と性格
表情が決まる 2 要因（好み + 性格）を整理。
「同じ性格でも配分で変わる、同じ配分でも性格で変わる」を強調。

### 3.5 `05_flow.html` — タスクの流れ
練習 2 → 本試行 6 → w 推定の 3 ステップを番号付きで提示。

### 3.6 `06_ui.html` — 操作の仕方
スライダー方向、緑の光、提案ボタン、1 試行 1 回ルールを説明。
**Qualtrics Library に UI スクリーンショットをアップロード** して、
`<div class="nip-figure-placeholder">` を `<img src="...">` に差し替え推奨。

### 3.7 `07_theta.html` + `07_theta.js` — 美咲の性格教示
**`cond_theta` の 4 水準に応じて自動的に**：
- 該当行を `.nip-highlighted`（黄色）でハイライト
- 教示文を `theta-instruction` に差替え
- ラベル `theta-label` に「協力的」「個人主義的」等を表示

→ Qualtrics の Display Logic 不要。Embedded Data の `cond_theta` 設定だけで動く。

### 3.8 `08_comprehension.html` + `08_comprehension.js` — 理解度チェック (9 問)
全問正解で次へ自動進行。
1 回目で誤答 → 赤枠表示 + 再回答促し（Qualtrics の同じ Question 内で再評価）。
2 回目以降の誤答 → 記録して進行（無限ループ防止）。

**保存される Embedded Data**:
| 変数名 | 内容 |
|---|---|
| `comprehension_q1` 〜 `comprehension_q9` | 各問の回答 (A/B/C/D 等) |
| `comprehension_q1_correct` 〜 `comprehension_q9_correct` | 各問の正誤 (1/0) |
| `comprehension_score` | 9 問中の正解数 |
| `comprehension_attempts` | 受験回数 (1, 2, ...) |
| `comprehension_first_attempt_score` | 1 回目の正解数 |

### 3.9 `09_attention.html` + `09_attention.js` — 事前注意確認
Instructed-response 形式。「あまり話さない」を選んだ場合のみ通過。

**保存される Embedded Data**:
| 変数名 | 内容 |
|---|---|
| `attention_pre_answer` | 選んだ値 (rarely / sometimes / very_often / ...) |
| `attention_pre_pass` | 1 (rarely 選択) / 0 (それ以外) |

---

## 4. Survey Flow の Embedded Data 事前宣言

主実験ブロックの前に **Set Embedded Data** で以下を宣言:

### 入力 (実験者が設定)

```
cond_theta     = competitive | individualistic | cooperative | altruistic
cond_tau       = moderate | extreme
cond_seq       = optimal | random
w_self         = "1,-2,-1"
w_other        = "0,-1,2"
issue1_img     = (Qualtrics Library の画像 URL)
issue2_img     = (同上)
issue3_img     = (同上)
```

### 出力 (空文字で宣言、JS が後で書き込む)

```
comprehension_q1, comprehension_q2, ... comprehension_q9
comprehension_q1_correct, ... comprehension_q9_correct
comprehension_score
comprehension_attempts
comprehension_first_attempt_score
attention_pre_answer
attention_pre_pass
```

---

## 5. 図像の差し替え（推奨作業）

| ファイル | 差し替え対象 | 推奨内容 |
|---|---|---|
| `02_misaki.html` | `<div class="nip-figure-placeholder">` | 美咲の静止画/Live2D スクショ |
| `06_ui.html` | `<div class="nip-figure-placeholder">` | メイン UI のスクリーンショット |

差し替え例:

```html
<!-- 修正前 -->
<div class="nip-figure">
  <div class="nip-figure-placeholder">
    [メイン UI のスクリーンショットをここに配置]
  </div>
</div>

<!-- 修正後 -->
<div class="nip-figure">
  <img src="https://your-qualtrics-library/.../ui_screenshot.png"
       alt="操作 UI" style="max-width:100%; border-radius:8px;" />
</div>
```

---

## 6. ナビゲーションの仕組み

| Question | 「次へ」の挙動 |
|---|---|
| 01〜07 | Qualtrics 標準の「次へ」ボタンが表示される |
| 08 (理解度) | JS が `hideNextButton()` で隠す → 「回答を確認する」ボタンで判定 → 全問正解時のみ JS が `clickNextButton()` |
| 09 (事前注意) | JS が `hideNextButton()` で隠す → 「回答する」ボタンで判定 → JS が `clickNextButton()` |

→ 参加者は途中の Q1-Q7 では戻る/進む自由がある。Q8, Q9 のみ強制的に判定が要る。

---

## 7. 動作確認チェックリスト

Qualtrics プレビューで:

- [ ] Q1 〜 Q7: 各ページが正しく表示され、Qualtrics の「次へ」で進める
- [ ] Q3: アイテム画像が `${e://Field/issueN_img}` で表示される (Embedded Data に URL を設定済みなら)
- [ ] Q7: `cond_theta` の値に応じて表の該当行が黄色く光り、教示文が変わる
- [ ] Q8: 全 9 問に回答せずに送信 → 未回答警告
- [ ] Q8: 1 問でも誤答 → 赤枠 + 再回答促し → 全問正解で自動進行
- [ ] Q8: 2 回目で誤答 → そのまま進行 (記録)
- [ ] Q9: 「あまり話さない」を選択 → `attention_pre_pass = 1` で進行
- [ ] Q9: 他を選択 → `attention_pre_pass = 0` で進行
- [ ] 主実験 (`main.html` + `main.js`) に正しく遷移する

---

## 8. ファイル構造

```
exp/qualtrics/instructions/
├─ 01_purpose.html              ← 個別ページ版
├─ 02_misaki.html               ← 個別ページ版
├─ 03_items.html                ← 個別ページ版
├─ 04_expression.html           ← 個別ページ版
├─ 05_flow.html                 ← 個別ページ版
├─ 06_ui.html                   ← 個別ページ版
├─ 07_theta.html                ← 個別ページ版
├─ 07_theta.js                  ← 個別ページ版
├─ 08_comprehension.html        ← 個別ページ版
├─ 08_comprehension.js          ← 個別ページ版
├─ 09_attention.html            ← 共通(統合版でも別 Question として使う)
├─ 09_attention.js              ← 共通
├─ combined.html                ← 統合版 (01〜08 を 1 Question にまとめる)
├─ combined.js                  ← 統合版
└─ README.md                    ← このファイル
```

**作成日**: 2026-05-03
**設計書**: `../PRE_TASK_INSTRUCTIONS.md`
