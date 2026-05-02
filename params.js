/* NeurIPS2026 実験パラメータ・系列定義
 *
 * Qualtrics 埋め込み変数（URL クエリパラメータ）対応版。
 * Qualtrics 側で embedded data を URL に付与すれば、以下を制御できる:
 *
 *   ?theta=competitive       # cond_theta: competitive | individualistic | cooperative | altruistic
 *   ?tau=moderate            # cond_tau:   moderate | extreme
 *   ?seq=optimal             # cond_seq:   optimal | random
 *   ?w_self=1,-2,-1          # w_self: カンマ区切りの 3 成分（推定対象）
 *   ?w_other=0,-1,2          # w_other: カンマ区切りの 3 成分（参加者の選好）
 *   ?pid=ABC123              # 参加者 ID（Qualtrics の Response ID 等）
 *   ?extreme_ratio=0.8       # extreme 条件の r 値（任意, デフォルト 0.8）
 *
 * Qualtrics 連携例（Survey Flow → Web Service / Branch → Embedded Data）:
 *   https://your-host.example.com/exp/?theta=${e://Field/cond_theta}&tau=${e://Field/cond_tau}&seq=${e://Field/cond_seq}&w_self=${e://Field/w_self}&w_other=${e://Field/w_other}&pid=${e://Field/ResponseID}
 *
 * 未指定の埋め込み変数はランダム or デフォルト値に fallback する。
 */

/* ============================================================
 * 1. 固定パラメータと既定値
 * ============================================================ */

const PARAMS = {
  /* デフォルト w_self / w_other（Qualtrics 未指定時に使用） */
  default_w_self:  [1.0, -2.0, -1.0],
  default_w_other: [0.0, -1.0, 2.0],

  /* 動的に設定される w（initFromQualtrics() で上書き） */
  w_self:  null,
  w_other: null,

  /* 試行・モデル定数 */
  T: 6,                          // 本試行数
  X_total: 5,                    // 各論点の総資源
  M: 3,                          // 論点数
  beta_softmax: 10.0,            // smooth extrema の β（paper_v5_new_FIM.md）
  K: 3,                          // 各方向の表情段階数（7 カテゴリ = 2K+1）

  /* 既定の extreme 比率（Qualtrics でも上書き可） */
  default_extreme_ratio: 0.8,
  effective_extreme_ratio: 0.8,  // initFromQualtrics() で更新

  /* UI / 操作制約 */
  maxChangesPerSlider: 3,
  minViewDurationMs: 5000,
  matchTolerance: 0,
  showRemainingCount: false,     // 残り操作回数表示のオン/オフ（JS から切替）

  /* 動的に計算される条件依存パラメータ（initConditionParams() で更新） */
  effective_theta_deg:        null,
  effective_c:                null,
  effective_delta_plus:       null,
  effective_delta_minus:      null,
  effective_tau_thresholds:   null,
  effective_u_max_beta:       null,
  effective_u_min_beta:       null,
};

const ISSUE_LABELS = ['論点1', '論点2', '論点3'];

const THETA_BY_CONDITION = {
  competitive:    -45,
  individualistic:  0,
  cooperative:     45,
  altruistic:      90,
};

const THETA_INSTRUCTIONS = {
  competitive:    '美咲は<strong>競争的な性格</strong>で、自分の利得だけでなく相手より多く得ることを重視します。',
  individualistic: '美咲は<strong>個人主義的な性格</strong>で、自分の利得のみを重視し、相手の結果には無関心です。',
  cooperative:    '美咲は<strong>協力的な性格</strong>で、自分と相手の利得を同等に重視します。',
  altruistic:     '美咲は<strong>利他的な性格</strong>で、相手の利得のみを重視し、自分の結果には無関心です。',
};

const SEQ_CONDITIONS = ['optimal', 'random'];
const TAU_CONDITIONS = ['moderate', 'extreme'];

/* ============================================================
 * 2. 数値ユーティリティ
 * ============================================================ */

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function deg2rad(deg) { return deg * Math.PI / 180; }

/* 配分空間 {0..X_total}^M を列挙 */
function enumerateAllAllocations(X_total = PARAMS.X_total, M = PARAMS.M) {
  const allocs = [];
  function recurse(current) {
    if (current.length === M) {
      allocs.push(current.slice());
      return;
    }
    for (let v = 0; v <= X_total; v++) {
      current.push(v);
      recurse(current);
      current.pop();
    }
  }
  recurse([]);
  return allocs;
}

/* smooth max: u_max^(β) = (1/β) log{ (1/|X|) Σ exp(β u_i) } */
function smoothMax(utilities, beta) {
  const maxU = Math.max(...utilities);
  let sumExp = 0;
  for (const u of utilities) sumExp += Math.exp(beta * (u - maxU));
  return maxU + Math.log(sumExp / utilities.length) / beta;
}

/* smooth min: u_min^(β) = -(1/β) log{ (1/|X|) Σ exp(-β u_i) } */
function smoothMin(utilities, beta) {
  const minU = Math.min(...utilities);
  let sumExp = 0;
  for (const u of utilities) sumExp += Math.exp(-beta * (u - minU));
  return minU - Math.log(sumExp / utilities.length) / beta;
}

/* w_self, w_other, θ から配分空間全体の効用と smooth extrema を計算 */
function computeUtilityRange(w_self, w_other, theta_deg) {
  const theta_rad = deg2rad(theta_deg);
  const cosT = Math.cos(theta_rad);
  const sinT = Math.sin(theta_rad);
  const allocs = enumerateAllAllocations();
  const utilities = allocs.map(x_self => {
    const x_other = x_self.map(v => PARAMS.X_total - v);
    return cosT * dot(w_self, x_self) + sinT * dot(w_other, x_other);
  });
  return {
    u_max_beta: smoothMax(utilities, PARAMS.beta_softmax),
    u_min_beta: smoothMin(utilities, PARAMS.beta_softmax),
    utilities,
    allocations: allocs,
  };
}

/* 公平配分 [X_total/2, ...] の効用 */
function computeFairUtility(w_self, w_other, theta_deg) {
  const theta_rad = deg2rad(theta_deg);
  const x_fair = Array.from({ length: PARAMS.M }, () => PARAMS.X_total / 2);
  return Math.cos(theta_rad) * dot(w_self, x_fair)
       + Math.sin(theta_rad) * dot(w_other, x_fair);
}

/* ============================================================
 * 3. 条件パラメータの動的計算
 * ============================================================ */

/* (condTheta, condTau, w_self, w_other) → c, Δ_+, Δ_-, τ閾値 */
function computeConditionParams(condTheta, condTau, w_self, w_other, extremeRatio = PARAMS.effective_extreme_ratio) {
  const theta_deg = THETA_BY_CONDITION[condTheta];
  if (theta_deg === undefined) {
    throw new Error(`Unknown theta condition: ${condTheta}`);
  }

  const range = computeUtilityRange(w_self, w_other, theta_deg);
  const u_max = range.u_max_beta;
  const u_min = range.u_min_beta;
  const width = u_max - u_min;
  if (width <= 0) {
    throw new Error(`Utility support degenerate for theta=${theta_deg}, w_self=${w_self}`);
  }

  let c;
  if (condTau === 'moderate') {
    /* paper_v5.md: c = u(fair; w_self, w_other, θ) */
    c = computeFairUtility(w_self, w_other, theta_deg);
  } else if (condTau === 'extreme') {
    /* paper_v5_new_FIM.md 3.5節: c = u_min + r·(u_max - u_min), r=0.8 */
    const r = Math.max(1e-6, Math.min(1 - 1e-6, extremeRatio));
    c = u_min + r * width;
  } else {
    throw new Error(`Unknown tau condition: ${condTau}`);
  }

  /* Δ_+, Δ_- の計算（utility-adaptive delta） */
  const K = PARAMS.K;
  const delta_plus  = (u_max - c) / K;
  const delta_minus = (c - u_min) / K;

  /* τ閾値: a_b ∈ {-3,-2,-1,0,1,2}（paper_v5_new_FIM.md） */
  const a_b = [-3, -2, -1, 0, 1, 2];
  const tau_thresholds = a_b.map(a =>
    a < 0 ? c + a * delta_minus : c + a * delta_plus
  );

  return {
    cond_theta: condTheta,
    cond_tau: condTau,
    theta_deg,
    c,
    delta_plus,
    delta_minus,
    tau_thresholds,
    u_max_beta: u_max,
    u_min_beta: u_min,
    a_b,
  };
}

/* PARAMS の effective_* に書き込む */
function applyConditionParams(condParams) {
  PARAMS.effective_theta_deg      = condParams.theta_deg;
  PARAMS.effective_c              = condParams.c;
  PARAMS.effective_delta_plus     = condParams.delta_plus;
  PARAMS.effective_delta_minus    = condParams.delta_minus;
  PARAMS.effective_tau_thresholds = condParams.tau_thresholds.slice();
  PARAMS.effective_u_max_beta     = condParams.u_max_beta;
  PARAMS.effective_u_min_beta     = condParams.u_min_beta;
  return condParams;
}

/* ============================================================
 * 4. Qualtrics 埋め込み変数のパース
 * ============================================================ */

function parseVectorParam(text, expectedLength = 3) {
  if (!text) return null;
  const parts = text.split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== expectedLength) return null;
  if (parts.some(v => Number.isNaN(v))) return null;
  return parts;
}

function parseRatioParam(text) {
  if (!text) return null;
  const v = parseFloat(text);
  if (Number.isNaN(v) || v <= 0 || v >= 1) return null;
  return v;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* URL クエリ → 条件 + w 設定をまとめて取得 */
function parseQualtricsEmbeddedVariables(searchString = location.search) {
  const url = new URLSearchParams(searchString);

  /* w_self / w_other */
  const wSelfRaw  = url.get('w_self')  || url.get('w');
  const wOtherRaw = url.get('w_other');
  const wSelfParsed  = parseVectorParam(wSelfRaw,  PARAMS.M);
  const wOtherParsed = parseVectorParam(wOtherRaw, PARAMS.M);
  const w_self  = wSelfParsed  || PARAMS.default_w_self.slice();
  const w_other = wOtherParsed || PARAMS.default_w_other.slice();

  /* extreme 比率（任意） */
  const ratio = parseRatioParam(url.get('extreme_ratio')) || PARAMS.default_extreme_ratio;

  /* 条件 */
  const cond_theta = url.get('theta') || pickRandom(Object.keys(THETA_BY_CONDITION));
  const cond_tau   = url.get('tau')   || pickRandom(TAU_CONDITIONS);
  const cond_seq   = url.get('seq')   || pickRandom(SEQ_CONDITIONS);

  /* バリデーション */
  if (!THETA_BY_CONDITION.hasOwnProperty(cond_theta)) {
    console.warn(`Unknown theta condition '${cond_theta}', using random.`);
  }
  if (!TAU_CONDITIONS.includes(cond_tau)) {
    console.warn(`Unknown tau condition '${cond_tau}', using random.`);
  }
  if (!SEQ_CONDITIONS.includes(cond_seq)) {
    console.warn(`Unknown seq condition '${cond_seq}', using random.`);
  }

  /* 参加者 ID */
  const pid = url.get('pid')
           || url.get('PROLIFIC_PID')
           || url.get('ResponseID')
           || `local_${Date.now()}`;

  return {
    cond_theta,
    cond_tau,
    cond_seq,
    w_self,
    w_other,
    extreme_ratio: ratio,
    pid,
    /* デバッグ用: 埋め込み変数のソースを記録 */
    _source: {
      w_self_from_url:  wSelfParsed  !== null,
      w_other_from_url: wOtherParsed !== null,
      theta_from_url:   url.get('theta')  !== null,
      tau_from_url:     url.get('tau')    !== null,
      seq_from_url:     url.get('seq')    !== null,
      ratio_from_url:   parseRatioParam(url.get('extreme_ratio')) !== null,
    },
  };
}

/* PARAMS に Qualtrics の値を反映 */
function applyQualtricsEmbeddedVariables(parsed) {
  PARAMS.w_self  = parsed.w_self.slice();
  PARAMS.w_other = parsed.w_other.slice();
  PARAMS.effective_extreme_ratio = parsed.extreme_ratio;
  return parsed;
}

/* 起動時の一括初期化:
 *   1. URL から埋め込み変数をパース
 *   2. PARAMS に w_self/w_other/extreme_ratio を反映
 *   3. (cond_theta, cond_tau) に基づき c, Δ_±, τ閾値を計算
 *   4. PARAMS の effective_* に書き込み
 *   5. parsed と condParams を返す
 */
function initFromQualtrics(searchString = location.search) {
  const parsed = parseQualtricsEmbeddedVariables(searchString);
  applyQualtricsEmbeddedVariables(parsed);

  const condParams = computeConditionParams(
    parsed.cond_theta,
    parsed.cond_tau,
    PARAMS.w_self,
    PARAMS.w_other,
    PARAMS.effective_extreme_ratio,
  );
  applyConditionParams(condParams);

  /* 構造化ログ */
  console.group('%c[Qualtrics init] 埋め込み変数', 'color:#7c3aed;font-weight:bold;');
  console.log('cond_theta :', parsed.cond_theta, `(θ = ${condParams.theta_deg}°)`,
              parsed._source.theta_from_url ? '[URL]' : '[random]');
  console.log('cond_tau   :', parsed.cond_tau,
              parsed._source.tau_from_url ? '[URL]' : '[random]');
  console.log('cond_seq   :', parsed.cond_seq,
              parsed._source.seq_from_url ? '[URL]' : '[random]');
  console.log('w_self     :', PARAMS.w_self,
              parsed._source.w_self_from_url ? '[URL]' : '[default]');
  console.log('w_other    :', PARAMS.w_other,
              parsed._source.w_other_from_url ? '[URL]' : '[default]');
  console.log('extreme r  :', PARAMS.effective_extreme_ratio,
              parsed._source.ratio_from_url ? '[URL]' : '[default]');
  console.log('participantId:', parsed.pid);
  console.log('---');
  console.log('c             :', condParams.c.toFixed(3));
  console.log('Δ_+           :', condParams.delta_plus.toFixed(3));
  console.log('Δ_-           :', condParams.delta_minus.toFixed(3));
  console.log('u_max^(β=10)  :', condParams.u_max_beta.toFixed(3));
  console.log('u_min^(β=10)  :', condParams.u_min_beta.toFixed(3));
  console.log('τ_b (a_b=-3..+2):', condParams.tau_thresholds.map(t => t.toFixed(3)));
  console.groupEnd();

  return { parsed, condParams };
}

/* ============================================================
 * 5. 観測系列の生成
 * ============================================================ */

/* ランダム系列（条件キーから seed 化したい場合のフック付き） */
function generateRandomSequence(T = PARAMS.T, X_total = PARAMS.X_total, M = PARAMS.M) {
  const seq = [];
  for (let t = 0; t < T; t++) {
    const allocation = [];
    for (let i = 0; i < M; i++) {
      allocation.push(Math.floor(Math.random() * (X_total + 1)));
    }
    seq.push(allocation);
  }
  return seq;
}

/* 練習試行（共通の2試行） */
const PRACTICE_RECOMMENDATIONS = [
  [2, 3, 1],
  [1, 2, 4],
];

/* E最適系列の事前計算データ（外部 JSON から非同期にロード）
 * 形式: OPTIMAL_SEQUENCES_DB[`${condTheta}|${condTau}`] = [[a,b,c], ...]
 */
let OPTIMAL_SEQUENCES_DB = null;

async function loadOptimalSequencesDb(url = './optimal_sequences.json') {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`optimal_sequences.json 読み込み失敗 (${response.status}); フォールバックを使用`);
      return null;
    }
    OPTIMAL_SEQUENCES_DB = await response.json();
    console.log('Optimal sequences loaded:', Object.keys(OPTIMAL_SEQUENCES_DB).length, 'entries');
    return OPTIMAL_SEQUENCES_DB;
  } catch (e) {
    console.warn('optimal_sequences.json fetch error:', e);
    return null;
  }
}

/* フォールバック用ダミー系列（DB 未読み込み時、デフォルト w での仮値） */
const FALLBACK_OPTIMAL_SEQUENCES = {
  competitive: {
    moderate: [[3,2,1],[1,4,2],[5,0,3],[2,5,1],[4,1,0],[0,3,5]],
    extreme:  [[5,0,0],[0,5,5],[4,1,2],[1,4,3],[5,2,0],[0,3,5]],
  },
  individualistic: {
    moderate: [[5,3,0],[2,4,1],[3,5,2],[1,2,4],[4,0,3],[0,1,5]],
    extreme:  [[5,5,0],[0,0,5],[5,3,1],[1,3,5],[5,0,3],[0,5,2]],
  },
  cooperative: {
    moderate: [[3,3,3],[2,3,4],[4,3,2],[3,2,3],[3,4,3],[2,4,3]],
    extreme:  [[5,5,5],[0,0,0],[4,4,4],[1,1,1],[5,2,2],[2,2,5]],
  },
  altruistic: {
    moderate: [[0,2,4],[1,3,5],[0,3,4],[2,4,5],[1,2,5],[0,4,3]],
    extreme:  [[0,0,5],[5,5,0],[0,1,5],[1,0,5],[0,5,5],[5,0,0]],
  },
};

/* 系列条件と θ・τ から推薦系列を取得 */
function getRecommendations(condTheta, condTau, condSeq) {
  if (condSeq === 'random') {
    return generateRandomSequence();
  }

  /* 1. 外部 DB から検索（推奨）*/
  if (OPTIMAL_SEQUENCES_DB) {
    const key = `${condTheta}|${condTau}`;
    const lookup = OPTIMAL_SEQUENCES_DB[key];
    if (lookup) {
      return lookup.map(arr => arr.slice());
    }
    console.warn(`Optimal sequence not found in DB for ${key}, falling back.`);
  }

  /* 2. フォールバック */
  const fb = FALLBACK_OPTIMAL_SEQUENCES[condTheta]?.[condTau];
  if (fb) {
    return fb.map(arr => arr.slice());
  }

  console.warn(`No sequence available for ${condTheta}/${condTau}, using random.`);
  return generateRandomSequence();
}

/* ============================================================
 * 6. 互換性のための補助関数
 * ============================================================ */

/* 旧 randomAssignCondition との互換性 */
function randomAssignCondition() {
  return {
    cond_theta: pickRandom(Object.keys(THETA_BY_CONDITION)),
    cond_tau:   pickRandom(TAU_CONDITIONS),
    cond_seq:   pickRandom(SEQ_CONDITIONS),
  };
}

/* ============================================================
 * 7. エクスポート
 * ============================================================ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARAMS, ISSUE_LABELS, THETA_BY_CONDITION, THETA_INSTRUCTIONS,
    SEQ_CONDITIONS, TAU_CONDITIONS,
    PRACTICE_RECOMMENDATIONS,
    /* 数値ユーティリティ */
    dot, deg2rad, enumerateAllAllocations, smoothMax, smoothMin,
    computeUtilityRange, computeFairUtility,
    /* 条件パラメータ */
    computeConditionParams, applyConditionParams,
    /* Qualtrics */
    parseQualtricsEmbeddedVariables, applyQualtricsEmbeddedVariables, initFromQualtrics,
    /* 系列 */
    generateRandomSequence, loadOptimalSequencesDb, getRecommendations,
    /* 互換 */
    randomAssignCondition,
  };
}
