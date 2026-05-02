/* 表情決定ロジック（paper_v5_new_FIM.md 準拠の utility-adaptive Δ 版）
 *
 * 新仕様:
 *   - 閾値 τ_b は params.js の computeConditionParams() で計算済み
 *   - PARAMS.effective_tau_thresholds に [τ_-3, τ_-2, τ_-1, τ_0, τ_+1, τ_+2] が入る
 *   - 累積リンクモデル P(Y ≤ b | u) = σ(τ_b - u) で確率が定まる
 *   - 実験では決定論性が必要 → "最頻カテゴリ" を返す（argmax_b P(Y=b|u)）
 *
 * 旧 API との互換性:
 *   - determineExpression(x_self, w_self, w_other, theta_deg, c, delta_joy, delta_anger, X_total)
 *     を維持（ただし非対称 Δ も受け付けるように拡張）
 */

const EXPRESSION_LEVELS = ['A3', 'A2', 'A1', 'N', 'J1', 'J2', 'J3'];

function expressionLabel(expr) {
  const labels = {
    A3: '強い怒り (A3)', A2: '怒り (A2)', A1: '不快 (A1)',
    N:  '中立 (N)',
    J1: 'やや喜び (J1)', J2: '喜び (J2)', J3: '強い喜び (J3)',
  };
  return labels[expr] ?? expr;
}

/* ロジスティック関数 */
function sigmoid(x) {
  if (x >= 500) return 1;
  if (x <= -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/* 効用 u の計算（params.js の dot/deg2rad を再利用 or fallback） */
function _utility(x_self, x_other, w_self, w_other, theta) {
  /* params.js が既に読み込まれていれば dot/deg2rad を使う */
  const _dot = (typeof dot === 'function')
    ? dot
    : (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  return Math.cos(theta) * _dot(w_self, x_self) + Math.sin(theta) * _dot(w_other, x_other);
}
function _deg2rad(deg) { return deg * Math.PI / 180; }

/* 閾値 τ_b 群と効用 u から累積リンク確率を計算
 *   P(Y=0|u)   = σ(τ_-3 - u)
 *   P(Y=k|u)   = σ(τ_b_k - u) - σ(τ_b_{k-1} - u)  (k=1..5)
 *   P(Y=6|u)   = 1 - σ(τ_+2 - u)
 *
 * thresholds: [τ_-3, τ_-2, τ_-1, τ_0, τ_+1, τ_+2] の 6 要素
 * → 7 カテゴリ確率を返す
 */
function categoryProbsFromThresholds(u, thresholds) {
  if (!thresholds || thresholds.length !== 6) {
    throw new Error('thresholds must be a length-6 array of τ_b values');
  }
  const cdfs = thresholds.map(t => sigmoid(t - u));
  const probs = new Array(7);
  probs[0] = cdfs[0];
  for (let i = 1; i < 6; i++) {
    probs[i] = Math.max(0, cdfs[i] - cdfs[i - 1]);
  }
  probs[6] = Math.max(0, 1 - cdfs[5]);
  return probs;
}

/* 配分・条件パラメータから「最頻カテゴリ」を返す（決定論版） */
function determineExpressionFromThresholds(x_self, x_other, w_self, w_other, theta_deg, thresholds) {
  const u = _utility(x_self, x_other, w_self, w_other, _deg2rad(theta_deg));
  const probs = categoryProbsFromThresholds(u, thresholds);
  let bestIdx = 0;
  let bestProb = probs[0];
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > bestProb) {
      bestProb = probs[i];
      bestIdx = i;
    }
  }
  return EXPRESSION_LEVELS[bestIdx];
}

/* 旧 API 互換ラッパ (fixed Δ_joy / Δ_anger を τ 列に展開して使用)
 * 旧コード:
 *   determineExpression(x_self, w_self, w_other, theta_deg, c, dj, da, X_total)
 *
 * 新コード (推奨):
 *   determineExpression(x_self, w_self, w_other, theta_deg, c, dj, da, X_total)
 *   → da を delta_minus、dj を delta_plus として
 *      τ_b = c + a_b · delta_minus (a_b<0)
 *      τ_b = c + a_b · delta_plus  (a_b>=0)
 *   を内部生成して累積リンクで判定
 */
function determineExpression(
  x_self, w_self, w_other, theta_deg, c,
  delta_joy, delta_anger,
  X_total
) {
  if (X_total === undefined) X_total = (typeof PARAMS !== 'undefined') ? PARAMS.X_total : 5;
  const x_other = x_self.map(v => X_total - v);

  /* 閾値: τ_b = c + a_b · Δ */
  const a_b = [-3, -2, -1, 0, 1, 2];
  const thresholds = a_b.map(a =>
    a < 0 ? c + a * delta_anger : c + a * delta_joy
  );
  return determineExpressionFromThresholds(x_self, x_other, w_self, w_other, theta_deg, thresholds);
}

/* PARAMS.effective_* を使う簡略 API
 * 起動時に initFromQualtrics() を呼んでおけば、これだけで表情判定できる
 */
function determineExpressionFromCurrentCondition(x_self) {
  if (!PARAMS.effective_tau_thresholds) {
    throw new Error('PARAMS.effective_tau_thresholds 未設定: initFromQualtrics() を先に呼んでください');
  }
  const X_total = PARAMS.X_total;
  const x_other = x_self.map(v => X_total - v);
  return determineExpressionFromThresholds(
    x_self, x_other,
    PARAMS.w_self, PARAMS.w_other,
    PARAMS.effective_theta_deg,
    PARAMS.effective_tau_thresholds,
  );
}

/* 旧 API 互換: utility(x_self, x_other, w_self, w_other, theta) */
function utility(x_self, x_other, w_self, w_other, theta) {
  return _utility(x_self, x_other, w_self, w_other, theta);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXPRESSION_LEVELS,
    expressionLabel,
    sigmoid,
    categoryProbsFromThresholds,
    determineExpressionFromThresholds,
    determineExpression,
    determineExpressionFromCurrentCondition,
    utility,
    /* 既存コードが import している可能性のある名前を維持 */
    dot: (typeof dot === 'function') ? dot : (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; },
    deg2rad: _deg2rad,
  };
}
