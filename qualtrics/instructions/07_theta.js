/* ============================================================
 * Q-9 美咲の性格教示 — Qualtrics Question JavaScript
 * cond_theta に応じて該当行をハイライト + 教示文を差替える
 * 「次へ」は Qualtrics の組込ボタンを使用 (clickNextButton 不要)
 * ============================================================ */

Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';

  function $val(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var v = el.value;
    if (!v) return fallback;
    /* 未置換 Piped Text("$" + "{" 始まり) を検出。
     * 36 = ドル記号, 123 = 波カッコ開
     */
    if (v.charCodeAt(0) === 36 && v.charCodeAt(1) === 123) return fallback;
    return v;
  }

  var THETA_LABEL = {
    competitive:    '競争的',
    individualistic: '個人主義的',
    cooperative:    '協力的',
    altruistic:     '利他的'
  };
  var THETA_INSTRUCTIONS = {
    competitive:    '美咲は<strong>競争的</strong>な性格で、自分の利得だけでなく、相手より多く得ることを重視します。',
    individualistic: '美咲は<strong>個人主義的</strong>な性格で、自分の利得のみを重視し、相手の結果には無関心です。',
    cooperative:    '美咲は<strong>協力的</strong>な性格で、自分と相手の利得を同等に重視します。',
    altruistic:     '美咲は<strong>利他的</strong>な性格で、相手の利得のみを重視し、自分の結果には無関心です。'
  };

  function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

  var cond_theta = $val('theta_emb_cond_theta', null);
  if (!THETA_LABEL.hasOwnProperty(cond_theta)) {
    cond_theta = pickRandom(Object.keys(THETA_LABEL));
  }

  /* ラベル + 教示文 */
  var labelEl = document.getElementById('theta-label');
  var instrEl = document.getElementById('theta-instruction');
  if (labelEl) labelEl.textContent = THETA_LABEL[cond_theta] || '?';
  if (instrEl) instrEl.innerHTML = THETA_INSTRUCTIONS[cond_theta] || '';

  /* 該当行をハイライト */
  var rowId = 'theta-row-' + cond_theta;
  var row = document.getElementById(rowId);
  if (row) row.classList.add('nip-highlighted');

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
