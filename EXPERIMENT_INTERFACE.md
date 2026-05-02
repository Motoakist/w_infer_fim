# NeurIPS2026 実験インタフェース仕様書

本ドキュメントは `exp/` 配下に実装されている Web 実験インタフェースの全体像を整理したもの。
`paper_v5_new_FIM.md`（utility-adaptive Δ 版表情モデル）に準拠している。

---

## 1. 実験の目的と構造

参加者は AI エージェント「**美咲**」が複数論点 (M=3) の資源配分にどのような感情的反応（**7段階表情**）を示すかを **6試行** 観察し、最後に美咲の重み `w_self` を **-2〜+2 の5段階**で推定する。

実験者の関心は次の点：

- 美咲の選好 `w_self`（推定対象、参加者には不可視）
- 参加者自身の選好 `w_other`（教示時に与えられる「あなたの重み」）
- SVO 角度 θ（competitive / individualistic / cooperative / altruistic の4水準）
- 表情閾値の τ 設定方式（moderate / extreme の2水準）
- 観測系列 (E最適 / random) の効率比較（optimal / random の2水準）

実験条件は **4 (θ) × 2 (τ) × 2 (seq) = 16 セル**。

---

## 2. ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | **本番用**。Block 3〜9 を 1 ページ内で切替えるオーケストレータ |
| `main_trial.html` | スタンドアロン版本試行（開発・デバッグ用、`index.html` の subset） |
| `w_estimation.html` | スタンドアロン版 w 推定 |
| `params.js` | パラメータ・条件計算・系列生成・Qualtrics 連携の中核 |
| `expression_logic.js` | 表情決定ロジック（累積リンクモデル、最頻カテゴリ判定） |
| `agent_canvas.js` | Live2D キャラクタ「美咲」(GeminoidF) の表情表示 |
| `table_view.js` | 3D 台形テーブル + 縦スライダー + アイテム画像描画 |
| `main_trial.js` | 試行ループ・状態管理・ロギング |
| `w_estimation.js` | w 推定スライダー UI |
| `style.css` | 共通スタイル |
| `stimuli/item{1,2,3}.png` | 3 種類のアイテム画像 |
| `deploy/` | AWS Lightsail デプロイ用の Nginx 設定 + setup/update スクリプト |

スクリプト読込順序（`index.html` 末尾）：jQuery → `params.js` → `expression_logic.js` → `agent_canvas.js` → `table_view.js` → `main_trial.js` → `w_estimation.js` → 本体オーケストレーション。

---

## 3. ブロック構成（参加者から見た流れ）

`index.html` の `<section class="block">` で実装され、JS 側の `show(id)` で 1 つだけ `.active` にする方式。

| ID | 内容 |
|---|---|
| `block-instruction` | 課題教示（「美咲を 6 回観察→ w を推定」の流れを説明） |
| `block-theta` | θ 条件に応じた美咲の性格紹介（`THETA_INSTRUCTIONS[cond_theta]`） |
| `block-practice-intro` | 練習開始ボタン |
| `screen-trial` | 試行画面：テーブル + 縦スライダー + 推薦値表示 + 提案ボタン。**提案後も同一画面**で表情だけ更新し、提案ボタン → 次へボタンに切替（5 秒タイマー） |
| `block-practice-done` | 練習完了 → 本試行への遷移 |
| `block-w` | w 推定（3 論点 × -2〜+2 の整数スライダー） |
| `block-post` | 事後質問（難易度・戦略自由記述・注意確認） |
| `block-debrief` | 終了画面 + デバッグ用にデータ表示 |

`screen-trial` と `screen-view` は **共有 `agent-panel` (`#shared-agent-panel`)** を JS で `attachAgentTo()` してスロットに差し込む構造。Live2D は最初の試行画面表示時に `requestAnimationFrame` 内で 1 回だけ初期化（遅延ロード）。

---

## 4. 条件設定とパラメータ計算

### 4.1 URL クエリ → 条件割付（Qualtrics 埋め込み変数対応）

`initFromQualtrics()` (`params.js:313`) が起動時に `location.search` から下記を取得：

```
?theta=competitive|individualistic|cooperative|altruistic
?tau=moderate|extreme
?seq=optimal|random
?w_self=1,-2,-1            # カンマ区切り 3 成分
?w_other=0,-1,2
?extreme_ratio=0.8         # extreme 条件の r 値（任意）
?pid=ABC123                # 参加者 ID（Qualtrics ResponseID 等）
```

未指定の値はランダム割付 / デフォルト値にフォールバック。

### 4.2 θ 条件と性格教示 (`THETA_BY_CONDITION`)

| 条件 | θ (deg) | 教示文 |
|---|---|---|
| `competitive` | -45 | 自分の利得だけでなく相手より多く得ることを重視 |
| `individualistic` | 0 | 自分の利得のみ重視、相手は無関心 |
| `cooperative` | 45 | 自分と相手を同等に重視 |
| `altruistic` | 90 | 相手の利得のみ重視、自分は無関心 |

### 4.3 効用関数

配分 \(x_{\text{self}} \in \{0..5\}^3\)、相手側 \(x_{\text{other}} = X_{\text{total}} - x_{\text{self}}\)（`X_total=5`）として：

\[
u(x) = \cos\theta \langle w_{\text{self}}, x_{\text{self}}\rangle + \sin\theta \langle w_{\text{other}}, x_{\text{other}}\rangle
\]

### 4.4 効用範囲の smooth extrema (`β=10`)

\[
u_{\max}^{(\beta)} = \frac{1}{\beta}\log\!\Big(\frac{1}{|\mathcal{X}|}\sum_x e^{\beta u(x)}\Big), \quad u_{\min}^{(\beta)} = -\frac{1}{\beta}\log\!\Big(\frac{1}{|\mathcal{X}|}\sum_x e^{-\beta u(x)}\Big)
\]

(`smoothMax/smoothMin` in `params.js:109-122`)

### 4.5 中心 c の決定（τ 条件依存）

| `cond_tau` | c の定義 |
|---|---|
| `moderate` | \(c = u(x_{\text{fair}}; w_{\text{self}}, w_{\text{other}}, \theta)\) （公平配分 [2.5, 2.5, 2.5] の効用） |
| `extreme` | \(c = u_{\min}^{(\beta)} + r \cdot (u_{\max}^{(\beta)} - u_{\min}^{(\beta)})\)（既定 r=0.8） |

### 4.6 utility-adaptive Δ と τ 閾値

K=3、`a_b ∈ {-3, -2, -1, 0, 1, 2}` として：

\[
\Delta_+ = \frac{u_{\max}^{(\beta)} - c}{K}, \quad \Delta_- = \frac{c - u_{\min}^{(\beta)}}{K}
\]

\[
\tau_b = \begin{cases} c + a_b \cdot \Delta_- & (a_b < 0) \\ c + a_b \cdot \Delta_+ & (a_b \geq 0) \end{cases}
\]

これらは `PARAMS.effective_tau_thresholds` に長さ 6 配列で格納される (`params.js:155-204`)。

---

## 5. 表情決定モデル（累積リンク → 最頻カテゴリ）

### 5.1 7 カテゴリ

`EXPRESSION_LEVELS = ['A3','A2','A1','N','J1','J2','J3']`

| ラベル | 意味 |
|---|---|
| A3 | 強い怒り |
| A2 | 怒り |
| A1 | 不快 |
| N | 中立 |
| J1 | やや喜び |
| J2 | 喜び |
| J3 | 強い喜び |

### 5.2 累積リンクモデル

\[
P(Y \leq b \mid u) = \sigma(\tau_b - u), \qquad b \in \{-3,-2,-1,0,+1,+2\}
\]

実験時は決定論性を確保するため、`determineExpressionFromThresholds()` が **argmax_b P(Y=b|u)** を返す（`expression_logic.js:65-77`）。

カテゴリ確率の式：
- \(P(Y=A3|u) = \sigma(\tau_{-3} - u)\)
- \(P(Y=k|u) = \sigma(\tau_b - u) - \sigma(\tau_{b-1} - u)\)（中間 5 カテゴリ）
- \(P(Y=J3|u) = 1 - \sigma(\tau_{+2} - u)\)

### 5.3 旧 API 互換ラッパ

`determineExpression(x_self, w_self, w_other, theta_deg, c, delta_joy, delta_anger, X_total)` も維持されており、内部で τ 列に展開して累積リンクを評価する（`expression_logic.js:90-104`）。

---

## 6. 試行画面の UI 詳細

### 6.1 テーブル (`table_view.js`)

- SVG で**長方形**を描画（台形による奥行き演出は廃止）
- 3 つの**縦レーン**を等間隔配置（**回転なし**、すべて垂直）
- 各レーンの構成：`[奥アイテム (opp-stack)] [縦スライダー] [残り回数表示※] [手前アイテム (self-stack)]`
  - **論点ラベル（`論点1` 等）は廃止**。アイテム画像で識別する
  - ※ 残り回数表示は `PARAMS.showRemainingCount` で **JS 側からオン/オフ切替**（既定 `false`）
- スライダー値 `value` の意味は **美咲（奥）側の枚数** = `x_self[i]`、参加者側は `X_total - value`
- アイテム画像は最大数 (`X_total=5`) ぶん事前生成し `display:none` で可視/不可視を切替（**値変化でレイアウトがブレない**）
- スライダーが推薦値と一致すると `.matched` クラスが付き緑のグロー

### 6.2 操作制約

| 制約 | 値 |
|---|---|
| 1 スライダーあたりの最大変更回数 | `PARAMS.maxChangesPerSlider = 3` |
| 残り操作回数表示のオン/オフ | `PARAMS.showRemainingCount`（既定 `false`、JS から切替） |
| 表情確認の最低視聴秒数 | `PARAMS.minViewDurationMs = 5000`（提案後 5 秒間 next ボタン無効） |
| 推薦値マッチの許容誤差 | `PARAMS.matchTolerance = 0` |
| 提案ボタン | 常時活性（推薦値と一致しなくても提案可） |
| 画面遷移 | 提案後も**同一画面**でテーブルが見えたまま、表情のみ更新 |

変更回数を使い切ると `TableView.lockSlider(idx)` でそのレーンが無効化、残り表示が `.exhausted` で赤くなる。

### 6.3 提案ボタン

3 状態の Qualtrics 画像 URL を切替：

| 状態 | 画像 |
|---|---|
| `no_push` | デフォルト |
| `pushed` | 押下中（500ms） |
| `bright` | ホバー |

加えて CSS で黄色いグロー (`#F9DB57`) ホバー効果（former_exp 由来）。

### 6.4 Live2D 美咲 (`agent_canvas.js`)

- モデル: GeminoidF (`Motoakist/geminoidF` の jsdelivr CDN)
- ライブラリ: `live2dcubismcore` + dylanNew/live2d + `indexLibraryRealtime.js`
- 7 段階表情を Live2D の `setExpression()` 名に直接マッピング：
  - `A3 → anger11-10`、`A2 → anger11-7`、`A1 → anger11-3`
  - `N → anger11-1, happy11-1` を 3 回交互（**ブレンド残響を消すため**）
  - `J1 → happy11-5`、`J2 → happy11-9`、`J3 → happy11-11`
- Live2D ロード失敗時は PNG フォールバック想定
- `setExpression` のモデル待機リトライ (12回 × 250ms)、表情間隔 80ms

---

## 7. 観測系列の生成

### 7.1 系列条件

- `cond_seq = 'optimal'`：E最適事前計算系列を `optimal_sequences.json` から非同期ロード（`loadOptimalSequencesDb()`）。形式 `{ "${theta}|${tau}": [[a,b,c], ...] }`
- `cond_seq = 'random'`：`generateRandomSequence()` で各論点 0..5 を一様サンプル

### 7.2 フォールバック

`OPTIMAL_SEQUENCES_DB` 未ロード時は `FALLBACK_OPTIMAL_SEQUENCES`（`params.js:398-415`）にハードコードされた仮系列を使用。

### 7.3 練習試行

`PRACTICE_RECOMMENDATIONS = [[2,3,1], [1,2,4]]` 固定の 2 試行。練習データは破棄され、本試行ログのみ残る。

---

## 8. ロギング (`MainTrial.sessionState`)

```js
{
  participantId, conditionTheta, conditionTau, conditionSeq,
  recommendations,           // T 試行ぶんの推薦配分
  trials: [{                 // 各試行のログ
    trial_index,
    recommendation,          // 推薦配分
    slider_history,          // [{idx, from, to, timeMs}, ...]
    slider_change_count,     // 各スライダーの変更回数
    final_proposal,          // 提案された x_self
    agent_expression,        // 表示された表情ラベル
    propose_time_ms,         // ラウンド開始 → 提案までの時間
    next_click_time_ms,      // 提案 → 次へ までの時間
  }],
  estimatedW,                // 参加者が答えた w 推定（3 値）
  isPractice, startedAt,
  // セッション開始時にスナップショットされる固定値
  w_self, w_other,           // 全試行で不変
  theta_deg, c_value,
  delta_plus, delta_minus,
  tau_thresholds,            // 6 要素
}
```

事後質問 (`postSurvey`) は `difficulty` (1-5)、`strategy`（自由記述）、`attention_check`（美咲は何回表情を変えたか）を保持。
最終データは `localStorage.neurips2026_full` に保存され、`#debug-log` に表示される（**Qualtrics 移行時はサーバ POST に置き換え予定**）。

### 重要な不変条件

`w_self`, `w_other`, `θ`, `c`, `Δ_±`, `τ_b` は **セッション開始時の `initSession()` で 1 回だけスナップショット**され、その後の試行ループでは固定。試行ごとに変わらないことが論文の同定条件として必要。

---

## 9. w 推定 (`w_estimation.js`)

- 3 論点 × 整数 5 段階スライダー (`-2, -1, 0, +1, +2`)
- ラベル: `-2 (嫌う)` / `-1` / `0 (無関心)` / `+1` / `+2 (重視)`
- 初期値 0、変更しなくても確定可能（寛容な実装）
- 確定値は `MainTrial.sessionState.estimatedW` に書き込み

---

## 10. デプロイ構成 (`deploy/`)

- AWS Lightsail Ubuntu 22.04 に Nginx で静的配信
- **HTTPS は実質必須**（Live2D の CDN が `https://` のため Mixed Content 回避）
- Let's Encrypt 証明書で SSL 化
- `setup.sh` がインストール・git clone・Nginx 設定・certbot を一括実行
- `update.sh` が `git pull` で更新（静的のみなので Nginx 再起動不要）

Qualtrics 移行時は HTML を Qualtrics の Text/Graphic Question に貼り、JS は Library アップロードまたは Lightsail 直接参照する想定。

---

## 11. 既知の設計上のポイント

- **共有 agent-panel**：trial と view 両画面で同じ Live2D を使い回し、再初期化のチラつきを避ける
- **Live2D 遅延ロード**：初回試行画面表示時の `requestAnimationFrame` 内で `init()`、ロード失敗で PNG フォールバック
- **N（中立）の表情リセット**：`anger11-1 → happy11-1` を 3 回繰り返してブレンド残響を消す（GeminoidF の `change_face()` の挙動が雑なため `setExpression()` を直接呼ぶ）
- **アイテム画像の事前生成**：可視/不可視のみ切替えてレイアウト不変を保証
- **提案ボタン常時活性**：推薦値と一致しなくても提案できる（マッチ判定はハイライトのみ）

---

## 12. 数式と論文との対応

`paper_v5_new_FIM.md` 3.5 節 (utility-adaptive Δ) と一対一対応：

| 論文記号 | 実装 |
|---|---|
| \(\theta\) | `THETA_BY_CONDITION[cond_theta]` (deg) |
| \(w_{\text{self}}, w_{\text{other}}\) | `PARAMS.w_self`, `PARAMS.w_other` |
| \(u_{\max}^{(\beta)}, u_{\min}^{(\beta)}\) | `smoothMax/smoothMin` with `β=10` |
| \(c\) (moderate) | `computeFairUtility(...)` |
| \(c\) (extreme) | `u_min + r·(u_max - u_min)`, r=0.8 |
| \(\Delta_+, \Delta_-\) | `(u_max - c)/K`, `(c - u_min)/K`, K=3 |
| \(\tau_b\) | `a_b ∈ {-3..+2}` を `c + a_b·Δ_∓` で展開 |
| \(P(Y \leq b \mid u) = \sigma(\tau_b - u)\) | `categoryProbsFromThresholds()` |
| 表情判定 | `argmax_b P(Y=b|u)`（決定論版） |
