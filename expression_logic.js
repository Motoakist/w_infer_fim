/* 表情決定ロジック（暫定: 決定論的ルール）
 * 後で paper_v5 の確率版（累積リンクモデル）に差し替える。
 */

const EXPRESSION_LEVELS = ['A3', 'A2', 'A1', 'N', 'J1', 'J2', 'J3'];

/* ベクトル内積 */
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/* °→ラジアン */
function deg2rad(deg) { return deg * Math.PI / 180; }

/* 効用 u を計算
 * x_self: 自分への配分ベクトル
 * x_other: 相手への配分ベクトル（X_total - x_self）
 * w_self / w_other: 重みベクトル
 * theta: ラジアン
 */
function utility(x_self, x_other, w_self, w_other, theta) {
  return Math.cos(theta) * dot(w_self, x_self) + Math.sin(theta) * dot(w_other, x_other);
}

/* 表情を決定する（決定論版） */
function determineExpression(x_self, w_self, w_other, theta_deg, c, delta_joy, delta_anger, X_total = 5) {
  const x_other = x_self.map(v => X_total - v);
  const u = utility(x_self, x_other, w_self, w_other, deg2rad(theta_deg));
  const z = u - c;

  if (z >=  3 * delta_joy)   return 'J3';
  if (z >=  2 * delta_joy)   return 'J2';
  if (z >=  1 * delta_joy)   return 'J1';
  if (z >  -1 * delta_anger) return 'N';
  if (z >  -2 * delta_anger) return 'A1';
  if (z >  -3 * delta_anger) return 'A2';
  return 'A3';
}

/* 表情からラベル文字列を得る（デバッグ用） */
function expressionLabel(expr) {
  const labels = {
    A3: '強い怒り (A3)', A2: '怒り (A2)', A1: '不快 (A1)',
    N:  '中立 (N)',
    J1: 'やや喜び (J1)', J2: '喜び (J2)', J3: '強い喜び (J3)',
  };
  return labels[expr] ?? expr;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXPRESSION_LEVELS, dot, deg2rad, utility, determineExpression, expressionLabel,
  };
}
