/* NeurIPS2026 実験パラメータ・系列定義
 * 仮値で実装。条件設計確定後はこのファイルだけ書き換えれば対応可能。
 */

const PARAMS = {
  // エージェントの選好（仮）— 論点1〜3 の重み
  w_self:  [2, 0, -2],
  // 観察者側の選好（仮、教示で既知化）
  w_other: [-2, 0, 2],
  // θ（条件で書き換え、ラジアン換算は使う側で行う）
  theta_deg: 0,
  // τ位置（u 空間における基準）
  c: 0,
  // 表情段階の幅（後で左右非対称化予定）
  delta_joy: 1.0,
  delta_anger: 1.0,
  // 試行数 T
  T: 6,
  // 各論点の最大資源（0〜5）
  X_total: 5,
  // 論点数
  M: 3,
  // 各スライダーの操作回数上限
  maxChangesPerSlider: 3,
  // 表情確認画面の最低提示時間（ms）
  minViewDurationMs: 5000,
  // 推薦値マッチ判定の許容幅（0=厳密一致）
  matchTolerance: 0,
};

/* 論点ラベル（仮） */
const ISSUE_LABELS = ['論点1', '論点2', '論点3'];

/* 条件ごとの θ（°）*/
const THETA_BY_CONDITION = {
  competitive:    -45,
  individualistic:  0,
  cooperative:     45,
  altruistic:      90,
};

/* θ教示文 */
const THETA_INSTRUCTIONS = {
  competitive:    '美咲は<strong>競争的な性格</strong>で、自分の利得だけでなく相手より多く得ることを重視します。',
  individualistic: '美咲は<strong>個人主義的な性格</strong>で、自分の利得のみを重視し、相手の結果には無関心です。',
  cooperative:    '美咲は<strong>協力的な性格</strong>で、自分と相手の利得を同等に重視します。',
  altruistic:     '美咲は<strong>利他的な性格</strong>で、相手の利得のみを重視し、自分の結果には無関心です。',
};

/* τ条件 → c 値（仮）*/
const C_BY_TAU = {
  moderate: 0.0,
  extreme:  2.0,
};

/* 推薦系列条件 */
const SEQ_CONDITIONS = ['optimal', 'random'];

/* 最適系列（仮データ）— 4θ × 2τ × T=6
 * 後で paper_v5 の効用関数から事前計算した系列に置き換える
 */
const OPTIMAL_SEQUENCES = {
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

/* 練習試行（共通の2試行） */
const PRACTICE_RECOMMENDATIONS = [
  [2, 3, 1],
  [1, 2, 4],
];

/* ランダム系列を生成する */
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

/* 系列条件と θ・τ から推薦系列を取得 */
function getRecommendations(condTheta, condTau, condSeq) {
  if (condSeq === 'random') {
    return generateRandomSequence();
  }
  const lookup = OPTIMAL_SEQUENCES[condTheta]?.[condTau];
  if (!lookup) {
    console.warn(`No optimal sequence for ${condTheta}/${condTau}, falling back to random`);
    return generateRandomSequence();
  }
  return lookup.map(arr => arr.slice());
}

/* 16条件をランダム割付（テスト用：実運用では Qualtrics の Randomizer を使う） */
function randomAssignCondition() {
  const thetas = Object.keys(THETA_BY_CONDITION);
  const taus = Object.keys(C_BY_TAU);
  const seqs = SEQ_CONDITIONS;
  return {
    cond_theta: thetas[Math.floor(Math.random() * thetas.length)],
    cond_tau:   taus[Math.floor(Math.random() * taus.length)],
    cond_seq:   seqs[Math.floor(Math.random() * seqs.length)],
  };
}

/* CommonJS / ブラウザ両対応のエクスポート */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARAMS, ISSUE_LABELS, THETA_BY_CONDITION, THETA_INSTRUCTIONS,
    C_BY_TAU, SEQ_CONDITIONS, OPTIMAL_SEQUENCES, PRACTICE_RECOMMENDATIONS,
    generateRandomSequence, getRecommendations, randomAssignCondition,
  };
}
