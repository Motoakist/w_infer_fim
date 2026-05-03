/* ============================================================
 * NeurIPS2026 実験 — Qualtrics Question JavaScript
 * Qualtrics の Question JavaScript パネルにこのコードを貼り付ける
 *
 * 内容:
 *  1. Embedded Data の読み込みと条件パラメータ計算
 *  2. 累積リンクモデルによる表情判定(7 カテゴリ, argmax)
 *  3. テーブル + スライダー + アイテム描画
 *  4. Live2D 美咲(GeminoidF)のロードと表情切替
 *  5. 試行ループ(練習 2 + 本試行 6)
 *  6. w 推定 + 事後質問 + Embedded Data 書出し
 * ============================================================ */

Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';

  var that = this;

  /* Qualtrics の標準次へボタンを隠し、ロジック完了で programmatically 進める */
  this.hideNextButton();

  /* ============================================================
   * 1. Embedded Data 読込 + 条件決定
   * ============================================================ */

  function $val(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var v = el.value;
    if (!v) return fallback;
    /* Qualtrics の Question JavaScript パネルはサーバ側で Piped Text を先行
     * 置換するため、JS ソース中に該当リテラル(ドル + 波カッコ開) を書くと構文
     * エラーになる。下のチェックは「未置換 Piped Text が文字列として残って
     * いるケース」を検出するが、リテラルを書けないので文字コードで判定する。
     * 36 = ドル記号, 123 = 波カッコ開
     */
    if (v.charCodeAt(0) === 36 && v.charCodeAt(1) === 123) {
      return fallback;
    }
    return v;
  }

  function parseCSVNumbers(text, expected, fallback) {
    if (!text) return fallback.slice();
    var parts = text.split(',').map(function (s) { return parseFloat(s.trim()); });
    if (parts.length !== expected) return fallback.slice();
    if (parts.some(function (v) { return isNaN(v); })) return fallback.slice();
    return parts;
  }

  var THETA_BY_CONDITION = {
    competitive:    -45,
    individualistic:  0,
    cooperative:     45,
    altruistic:      90
  };
  var THETA_INSTRUCTIONS = {
    competitive:     '美咲は<strong>競争的な性格</strong>で、自分の利得だけでなく相手より多く得ることを重視します。',
    individualistic: '美咲は<strong>個人主義的な性格</strong>で、自分の利得のみを重視し、相手の結果には無関心です。',
    cooperative:     '美咲は<strong>協力的な性格</strong>で、自分と相手の利得を同等に重視します。',
    altruistic:      '美咲は<strong>利他的な性格</strong>で、相手の利得のみを重視し、自分の結果には無関心です。'
  };
  var SEQ_CONDITIONS = ['optimal', 'random'];
  var TAU_CONDITIONS = ['moderate', 'extreme'];

  var pickRandom = function (list) { return list[Math.floor(Math.random() * list.length)]; };

  var cond_theta = $val('emb_cond_theta', null);
  if (!THETA_BY_CONDITION.hasOwnProperty(cond_theta)) {
    cond_theta = pickRandom(Object.keys(THETA_BY_CONDITION));
  }
  var cond_tau = $val('emb_cond_tau', null);
  if (TAU_CONDITIONS.indexOf(cond_tau) < 0) cond_tau = pickRandom(TAU_CONDITIONS);
  var cond_seq = $val('emb_cond_seq', null);
  if (SEQ_CONDITIONS.indexOf(cond_seq) < 0) cond_seq = pickRandom(SEQ_CONDITIONS);

  var DEFAULT_W_SELF  = [1.0, -2.0, -1.0];
  var DEFAULT_W_OTHER = [0.0, -1.0,  2.0];
  var w_self  = parseCSVNumbers($val('emb_w_self', null),  3, DEFAULT_W_SELF);
  var w_other = parseCSVNumbers($val('emb_w_other', null), 3, DEFAULT_W_OTHER);
  var extreme_ratio = parseFloat($val('emb_extreme_ratio', '0.8'));
  if (isNaN(extreme_ratio) || extreme_ratio <= 0 || extreme_ratio >= 1) extreme_ratio = 0.8;

  /* 画像 URL
   * アイテム画像は former_exp.js と同じく Qualtrics の Piped Text を JS リテラル
   * に直接埋め込んで取得する。サーバ側で先行置換されるので、貼り付け前のソースに
   * は ${e://Field/...} の形を残しておく必要がある。
   * 提案ボタン画像は former_exp.js のとおりハードコード。
   */
  var items = {
    issue1: { img_url: '${e://Field/issue1_img}' },
    issue2: { img_url: '${e://Field/issue2_img}' },
    issue3: { img_url: '${e://Field/issue3_img}' }
  };

  /* 未置換 Piped Text("$" + "{") の検出ヘルパ */
  function piped(s) {
    if (!s) return null;
    if (s.charCodeAt(0) === 36 && s.charCodeAt(1) === 123) return null;
    return s;
  }

  var ITEM_IMAGES = [
    piped(items.issue1.img_url) || 'https://via.placeholder.com/40?text=1',
    piped(items.issue2.img_url) || 'https://via.placeholder.com/40?text=2',
    piped(items.issue3.img_url) || 'https://via.placeholder.com/40?text=3'
  ];

  var PROPOSE_BTN_IMG = {
    normal: 'https://rc1userv5pwvgnvtxbwj.au1.qualtrics.com/ControlPanel/Graphic.php?IM=IM_37see1hsKpzpuAK',
    pushed: 'https://rc1userv5pwvgnvtxbwj.au1.qualtrics.com/ControlPanel/Graphic.php?IM=IM_bln2nk0YWrbZU5E',
    bright: 'https://rc1userv5pwvgnvtxbwj.au1.qualtrics.com/ControlPanel/Graphic.php?IM=IM_b28iR0DizQNxbYG'
  };

  /* ============================================================
   * 2. 固定パラメータ
   * ============================================================ */

  var PARAMS = {
    T: 6,
    X_total: 5,
    M: 3,
    beta_softmax: 10.0,
    K: 3,
    minViewDurationMs: 5000,
    matchTolerance: 0,
    showRemainingCount: false,    // JS 側で true/false 切替
    maxChangesPerSlider: 3
  };

  /* ============================================================
   * 3. 数値ユーティリティ + 条件パラメータ
   * ============================================================ */

  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]*b[i]; return s; }
  function deg2rad(deg) { return deg * Math.PI / 180; }
  function sigmoid(x) {
    if (x >= 500) return 1; if (x <= -500) return 0;
    return 1 / (1 + Math.exp(-x));
  }

  function enumerateAllAllocations() {
    var allocs = [];
    function rec(cur) {
      if (cur.length === PARAMS.M) { allocs.push(cur.slice()); return; }
      for (var v = 0; v <= PARAMS.X_total; v++) { cur.push(v); rec(cur); cur.pop(); }
    }
    rec([]);
    return allocs;
  }

  function smoothMax(us, beta) {
    var m = Math.max.apply(null, us), s = 0;
    for (var i = 0; i < us.length; i++) s += Math.exp(beta * (us[i] - m));
    return m + Math.log(s / us.length) / beta;
  }
  function smoothMin(us, beta) {
    var m = Math.min.apply(null, us), s = 0;
    for (var i = 0; i < us.length; i++) s += Math.exp(-beta * (us[i] - m));
    return m - Math.log(s / us.length) / beta;
  }

  function computeUtilityRange(ws, wo, theta_deg) {
    var c = Math.cos(deg2rad(theta_deg)), s = Math.sin(deg2rad(theta_deg));
    var allocs = enumerateAllAllocations();
    var us = allocs.map(function (xs) {
      var xo = xs.map(function (v) { return PARAMS.X_total - v; });
      return c * dot(ws, xs) + s * dot(wo, xo);
    });
    return { u_max: smoothMax(us, PARAMS.beta_softmax), u_min: smoothMin(us, PARAMS.beta_softmax) };
  }
  function computeFairUtility(ws, wo, theta_deg) {
    var c = Math.cos(deg2rad(theta_deg)), s = Math.sin(deg2rad(theta_deg));
    var xf = []; for (var i = 0; i < PARAMS.M; i++) xf.push(PARAMS.X_total / 2);
    return c * dot(ws, xf) + s * dot(wo, xf);
  }

  var theta_deg = THETA_BY_CONDITION[cond_theta];
  var range = computeUtilityRange(w_self, w_other, theta_deg);
  var u_max = range.u_max, u_min = range.u_min, width = u_max - u_min;
  var c_value;
  if (cond_tau === 'moderate') {
    c_value = computeFairUtility(w_self, w_other, theta_deg);
  } else {
    c_value = u_min + extreme_ratio * width;
  }
  var delta_plus  = (u_max - c_value) / PARAMS.K;
  var delta_minus = (c_value - u_min) / PARAMS.K;
  var a_b = [-3, -2, -1, 0, 1, 2];
  var tau_thresholds = a_b.map(function (a) {
    return a < 0 ? c_value + a * delta_minus : c_value + a * delta_plus;
  });

  console.log('[Qualtrics init]', {
    cond_theta: cond_theta, cond_tau: cond_tau, cond_seq: cond_seq,
    w_self: w_self, w_other: w_other, theta_deg: theta_deg,
    c: c_value, delta_plus: delta_plus, delta_minus: delta_minus,
    tau_thresholds: tau_thresholds
  });

  /* ============================================================
   * 4. 表情判定(累積リンク + argmax 決定論)
   * ============================================================ */

  var EXPRESSION_LEVELS = ['A3','A2','A1','N','J1','J2','J3'];

  function categoryProbs(u, taus) {
    var cdfs = taus.map(function (t) { return sigmoid(t - u); });
    var p = new Array(7);
    p[0] = cdfs[0];
    for (var i = 1; i < 6; i++) p[i] = Math.max(0, cdfs[i] - cdfs[i-1]);
    p[6] = Math.max(0, 1 - cdfs[5]);
    return p;
  }

  function determineExpression(xs) {
    var xo = xs.map(function (v) { return PARAMS.X_total - v; });
    var u = Math.cos(deg2rad(theta_deg)) * dot(w_self, xs)
          + Math.sin(deg2rad(theta_deg)) * dot(w_other, xo);
    var probs = categoryProbs(u, tau_thresholds);
    var best = 0, bp = probs[0];
    for (var i = 1; i < probs.length; i++) {
      if (probs[i] > bp) { bp = probs[i]; best = i; }
    }
    return { expr: EXPRESSION_LEVELS[best], u: u, probs: probs };
  }

  /* ============================================================
   * 5. 観測系列(練習 + 本試行)
   * ============================================================ */

  var PRACTICE_RECOMMENDATIONS = [[2,3,1], [1,2,4]];

  /* E最適系列のフォールバック(条件ごとに事前計算した想定値, params.js と同一) */
  var FALLBACK_OPTIMAL_SEQUENCES = {
    competitive:     { moderate: [[3,2,1],[1,4,2],[5,0,3],[2,5,1],[4,1,0],[0,3,5]],
                       extreme:  [[5,0,0],[0,5,5],[4,1,2],[1,4,3],[5,2,0],[0,3,5]] },
    individualistic: { moderate: [[5,3,0],[2,4,1],[3,5,2],[1,2,4],[4,0,3],[0,1,5]],
                       extreme:  [[5,5,0],[0,0,5],[5,3,1],[1,3,5],[5,0,3],[0,5,2]] },
    cooperative:     { moderate: [[3,3,3],[2,3,4],[4,3,2],[3,2,3],[3,4,3],[2,4,3]],
                       extreme:  [[5,5,5],[0,0,0],[4,4,4],[1,1,1],[5,2,2],[2,2,5]] },
    altruistic:      { moderate: [[0,2,4],[1,3,5],[0,3,4],[2,4,5],[1,2,5],[0,4,3]],
                       extreme:  [[0,0,5],[5,5,0],[0,1,5],[1,0,5],[0,5,5],[5,0,0]] }
  };

  function generateRandomSequence() {
    var seq = [];
    for (var t = 0; t < PARAMS.T; t++) {
      var a = [];
      for (var i = 0; i < PARAMS.M; i++) a.push(Math.floor(Math.random() * (PARAMS.X_total + 1)));
      seq.push(a);
    }
    return seq;
  }

  function getMainRecommendations() {
    if (cond_seq === 'random') return generateRandomSequence();
    var fb = FALLBACK_OPTIMAL_SEQUENCES[cond_theta];
    if (fb && fb[cond_tau]) return fb[cond_tau].map(function (r) { return r.slice(); });
    return generateRandomSequence();
  }

  /* ============================================================
   * 6. テーブル + スライダー描画
   * ============================================================ */

  var TABLE_WIDTH = 720, TABLE_HEIGHT = 360;
  var tableState = null;

  function laneX(idx, total) { return TABLE_WIDTH * (idx + 1) / (total + 1); }

  function renderTable(rootEl, opts) {
    var num = opts.itemImages.length, max = opts.itemMax;
    var showRemaining = !!PARAMS.showRemainingCount;

    rootEl.innerHTML =
      '<div class="table-3d">' +
        '<div class="table-side-label opponent">\u2191 \u7f8e\u54b2(\u5965)</div>' +
        '<svg class="table-3d-svg" viewBox="0 0 ' + TABLE_WIDTH + ' ' + TABLE_HEIGHT + '" preserveAspectRatio="none">' +
          '<rect x="0" y="0" width="' + TABLE_WIDTH + '" height="' + TABLE_HEIGHT + '"></rect>' +
        '</svg>' +
        '<div class="lanes"></div>' +
        '<div class="table-side-label self">\u2193 \u3042\u306a\u305f(\u624b\u524d)</div>' +
      '</div>';

    var lanesEl = rootEl.querySelector('.lanes');
    tableState = { rootEl: rootEl, opts: opts, lanes: [] };

    for (var i = 0; i < num; i++) {
      var cx = laneX(i, num);
      var leftPct = (cx / TABLE_WIDTH) * 100;

      var lane = document.createElement('div');
      lane.className = 'lane';
      lane.style.left = 'calc(' + leftPct + '% - 50px)';
      var remHtml = showRemaining
        ? '<div class="lane-remaining" data-idx="' + i + '">残り <span class="remaining-num">' + (opts.maxChanges || '-') + '</span> 回</div>'
        : '';
      lane.innerHTML =
        '<div class="opp-stack" data-idx="' + i + '"></div>' +
        '<input type="range" class="lane-slider" min="0" max="' + max + '" step="1" value="' + (opts.initialValues[i] || 0) + '" data-idx="' + i + '" />' +
        remHtml +
        '<div class="self-stack" data-idx="' + i + '"></div>';
      lanesEl.appendChild(lane);

      var oppStack = lane.querySelector('.opp-stack');
      var selfStack = lane.querySelector('.self-stack');
      for (var j = 0; j < max; j++) {
        var im1 = document.createElement('img');
        im1.src = opts.itemImages[i]; im1.className = 'item-img opp-item-img';
        oppStack.appendChild(im1);
        var im2 = document.createElement('img');
        im2.src = opts.itemImages[i]; im2.className = 'item-img self-item-img';
        selfStack.appendChild(im2);
      }

      var slider = lane.querySelector('input.lane-slider');
      var entry = { lane: lane, slider: slider, oppStack: oppStack, selfStack: selfStack };
      tableState.lanes.push(entry);

      paintItems(i, opts.initialValues[i] || 0, entry);
      updateMatchClass(i, opts.initialValues[i] || 0, entry);

      slider.addEventListener('input', (function (idx) {
        return function (ev) {
          var v = parseInt(ev.target.value, 10);
          paintItems(idx, v); updateMatchClass(idx, v);
          if (typeof opts.onInput === 'function') opts.onInput(idx, v);
        };
      })(i));
      slider.addEventListener('change', (function (idx) {
        return function (ev) {
          var v = parseInt(ev.target.value, 10);
          if (typeof opts.onChange === 'function') opts.onChange(idx, v);
        };
      })(i));
    }
  }

  function paintItems(idx, value, laneOverride) {
    var max = tableState.opts.itemMax;
    var lane = laneOverride || (tableState.lanes ? tableState.lanes[idx] : null);
    if (!lane) return;
    var myImgs = lane.selfStack.querySelectorAll('.self-item-img');
    var opImgs = lane.oppStack.querySelectorAll('.opp-item-img');
    var myVal = max - value, opVal = value;
    for (var k = 0; k < myImgs.length; k++) myImgs[k].style.display = (k < myVal) ? '' : 'none';
    for (var k2 = 0; k2 < opImgs.length; k2++) opImgs[k2].style.display = (k2 < opVal) ? '' : 'none';
  }

  function updateMatchClass(idx, value, laneOverride) {
    if (!tableState) return;
    var lane = laneOverride || tableState.lanes[idx];
    if (!lane) return;
    var rec = tableState.opts.recommendation && tableState.opts.recommendation[idx];
    if (rec === undefined || rec === null) return;
    lane.slider.classList.toggle('matched', Number(value) === Number(rec));
  }

  function lockAllSliders() {
    if (!tableState) return;
    tableState.lanes.forEach(function (l) { l.slider.disabled = true; });
  }
  function lockSlider(idx) {
    if (!tableState) return;
    if (tableState.lanes[idx]) tableState.lanes[idx].slider.disabled = true;
  }

  function resetTableForTrial(opts) {
    if (!tableState) return;
    if (opts.recommendation) tableState.opts.recommendation = opts.recommendation.slice();
    if (opts.initialValues)  tableState.opts.initialValues  = opts.initialValues.slice();
    tableState.lanes.forEach(function (lane, i) {
      var v = (opts.initialValues && opts.initialValues[i]) || 0;
      lane.slider.value = String(v);
      lane.slider.disabled = false;
      paintItems(i, v, lane);
      updateMatchClass(i, v, lane);
    });
    if (PARAMS.showRemainingCount) {
      var rems = tableState.rootEl.querySelectorAll('.lane-remaining');
      for (var i = 0; i < rems.length; i++) {
        var n = rems[i].querySelector('.remaining-num');
        if (n) n.textContent = String(opts.maxChanges || '-');
        rems[i].classList.remove('exhausted');
      }
    }
  }

  function isTableRendered() {
    return !!(tableState && tableState.rootEl && tableState.rootEl.querySelector('.table-3d'));
  }

  /* ============================================================
   * 7. Live2D 美咲(GeminoidF)
   * ============================================================ */

  var EXPR_TO_LIVE2D = {
    A3: ['anger11-10'],
    A2: ['anger11-7'],
    A1: ['anger11-3'],
    N:  ['anger11-1','happy11-1','anger11-1','happy11-1','anger11-1','happy11-1'],
    J1: ['happy11-5'],
    J2: ['happy11-8'],
    J3: ['happy11-11']
  };

  var LIVE2D_RESOURCES = [
    'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
    'https://cdn.jsdelivr.net/gh/Motoakist/geminoidF@1dde6a0d3338d14148f61b376227501880b8a5cd/js/indexLibraryRealtime.js'
  ];
  var MODEL_PATH = 'https://cdn.jsdelivr.net/gh/Motoakist/geminoidF@caf3917782d785add25041d470a6db22380a039e/GeminoidF_key_reduced/moc/GeminoidF_new/GeminoidF_new.model3.json';
  var POSITION = { boxWidth: 1000, boxHeight: 1000, modelScale: 0.15, modelX: 0, modelY: 500 };
  var indexLibrary = null;
  var live2dReady = false;

  function loadLive2DResource(idx, done) {
    if (idx >= LIVE2D_RESOURCES.length) { done(); return; }
    jQuery.getScript(LIVE2D_RESOURCES[idx])
      .done(function () { loadLive2DResource(idx + 1, done); })
      .fail(function () { console.warn('Live2D resource load failed:', LIVE2D_RESOURCES[idx]); done(false); });
  }

  function initLive2D() {
    var canvas = document.getElementById('agentCanvas');
    if (!canvas) return;
    canvas.id = 'myCanvas'; // IndexLibrary が #myCanvas を期待
    try {
      indexLibrary = new window.IndexLibrary(false, '', MODEL_PATH, POSITION);
      indexLibrary.onload();
      live2dReady = true;
      _seqSetExpr(['anger11-1', 'happy11-1']);
    } catch (e) {
      console.warn('Live2D init failed:', e);
      live2dReady = false;
    }
  }

  function _getModel() {
    return (indexLibrary && indexLibrary.app && indexLibrary.app.pixiCanvas)
      ? indexLibrary.app.pixiCanvas.hiyori : null;
  }

  function _seqSetExpr(names, retries) {
    if (retries === undefined) retries = 12;
    if (!indexLibrary) return;
    var model = _getModel();
    if (!model || typeof model.setExpression !== 'function') {
      if (retries > 0) setTimeout(function () { _seqSetExpr(names, retries - 1); }, 250);
      return;
    }
    names.forEach(function (n, i) {
      var apply = function () { try { model.setExpression(n); } catch (e) {} };
      if (i === 0) apply();
      else setTimeout(apply, i * 80);
    });
  }

  function setAgentExpression(expr) {
    if (!live2dReady || !indexLibrary) return;
    var seq = EXPR_TO_LIVE2D[expr];
    if (Array.isArray(seq) && seq.length) _seqSetExpr(seq);
  }

  /* ============================================================
   * 8. 試行ループ
   * ============================================================ */

  var rootApp = document.getElementById('neurips-app');
  function $sel(sel, root) { return (root || rootApp).querySelector(sel); }

  /* 共有 agent-panel をスロットへ差し込む */
  var sharedAgentPanel = $sel('#shared-agent-panel');
  function attachAgent(screenEl) {
    var slot = $sel('.agent-panel-slot', screenEl);
    if (slot) { sharedAgentPanel.style.display = ''; slot.appendChild(sharedAgentPanel); }
  }
  function detachAgent() { sharedAgentPanel.style.display = 'none'; }

  /* ブロック切替
   * 「実験の概要」「美咲について」「w 推定」「事後質問」「デブリーフィング」は
   * 別 Question で扱う想定。この Question は練習 + 本試行のみを担当する。
   * 本試行 6 回が終わったら Embedded Data を書出して clickNextButton() する。
   */
  var blocks = ['block-practice-intro','screen-trial','block-practice-done'];
  var currentShownId = null;
  function showBlock(id) {
    var same = (currentShownId === id);
    currentShownId = id;
    blocks.forEach(function (b) {
      var el = document.getElementById(b);
      if (el) el.classList.toggle('active', b === id);
    });
    if (id !== 'screen-trial') detachAgent();
    if (!same) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* 試行ログ */
  var sessionStartTime = performance.now();
  var sessionStartedAtIso = new Date().toISOString();
  var phase = 'practice';   // 'practice' | 'main'
  var currentTrial = 1;
  var practiceRecs = PRACTICE_RECOMMENDATIONS.map(function (r) { return r.slice(); });
  var mainRecs = getMainRecommendations();
  var trialStates = []; // 本試行のみ残す
  var trialState = null;
  var viewTimerHandle = null;

  var screenTrial = document.getElementById('screen-trial');

  function startTrial(idx) {
    var recs = (phase === 'practice') ? practiceRecs : mainRecs;
    trialState = {
      trialIndex: idx,
      recommendation: recs[idx - 1].slice(),
      sliderValues: [0, 0, 0],
      sliderChangeCounts: [0, 0, 0],
      sliderHistory: [],
      /* former_exp.js と同様: 各 issue の値履歴 / 時間履歴を CSV 文字列で記録。
       * 初期値(0)で開始し、操作のたびに ", 値" を追記する。
       * 時間は試行開始(roundStartTime)からの経過秒数(小数 3 桁)。
       */
      posHistoryStr:  ['0,', '0,', '0,'],
      timeHistoryStr: ['',   '',   ''],
      /* 全 3 スライダーのスナップショットを操作のたびに push (JSON 用) */
      positionsFull: [[0, 0, 0]],
      hasProposed: false,
      agentExpression: 'N',
      goodnessRating: null,         // 提案後の 7段階評定 (1〜7, 未回答は null)
      roundStartTime: performance.now(),
      proposedAt: null,
      nextClickedAt: null
    };
  }

  function renderTrialScreen() {
    var totalTrials = (phase === 'practice') ? practiceRecs.length : PARAMS.T;
    var counter = $sel('.trial-counter', screenTrial);
    if (counter) counter.textContent = (phase === 'practice')
      ? '練習試行 ' + trialState.trialIndex + ' / ' + totalTrials
      : '試行 ' + trialState.trialIndex + ' / ' + totalTrials;

    if (live2dReady) setAgentExpression('N');

    /* 推薦配分を 2 段の表として描画
     *   [    ] [item1 img] [item2 img] [item3 img]
     *   [美咲]    op1         op2         op3
     *   [あなた]  my1         my2         my3
     */
    var recTableContainer = $sel('.recommendation-table-container', screenTrial);
    if (recTableContainer) {
      var headerCells = trialState.recommendation.map(function (_, i) {
        return '<th><img src="' + ITEM_IMAGES[i] + '" class="rec-item-img" alt="item' + (i+1) + '"></th>';
      }).join('');
      var oppCells = trialState.recommendation.map(function (op) {
        return '<td><span class="rec-big">' + op + '</span></td>';
      }).join('');
      var myCells = trialState.recommendation.map(function (op) {
        return '<td><span class="rec-big">' + (PARAMS.X_total - op) + '</span></td>';
      }).join('');
      recTableContainer.innerHTML =
        '<table class="rec-table">' +
          '<thead>' +
            '<tr><th class="rec-corner"></th>' + headerCells + '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr><th class="rec-row-label">美咲</th>' + oppCells + '</tr>' +
            '<tr><th class="rec-row-label">あなた</th>' + myCells + '</tr>' +
          '</tbody>' +
        '</table>';
    }
    var recTitle = $sel('.rec-title', screenTrial);
    if (recTitle) recTitle.textContent = '試していただきたい配分';

    var proposeBtn = $sel('.propose-btn', screenTrial);
    var nextBtn = $sel('.next-btn', screenTrial);
    var timerNote = $sel('.timer-note', screenTrial);
    if (proposeBtn) {
      proposeBtn.style.display = '';
      proposeBtn.disabled = false;
      var img = proposeBtn.querySelector('img');
      if (img) img.src = PROPOSE_BTN_IMG.normal;
    }
    if (nextBtn) { nextBtn.style.display = 'none'; nextBtn.disabled = true; }
    if (timerNote) timerNote.textContent = '';

    /* 評定パネルを非表示 + 選択肢クリア */
    var ratingPanel = $sel('.rating-panel', screenTrial);
    if (ratingPanel) ratingPanel.style.display = 'none';
    var ratingInputs = screenTrial.querySelectorAll('input[name="goodness-rating"]');
    for (var ri = 0; ri < ratingInputs.length; ri++) ratingInputs[ri].checked = false;

    /* テーブル */
    var tableBox = $sel('.table-container', screenTrial);
    var tableOpts = {
      itemImages: ITEM_IMAGES,
      itemMax: PARAMS.X_total,
      maxChanges: PARAMS.maxChangesPerSlider,
      initialValues: trialState.sliderValues.slice(),
      recommendation: trialState.recommendation.slice(),
      onChange: function (idx, value) { onSliderChange(idx, value); }
    };
    if (isTableRendered()) {
      resetTableForTrial(tableOpts);
    } else {
      renderTable(tableBox, tableOpts);
    }
  }

  function onSliderChange(idx, value) {
    if (!trialState || trialState.hasProposed) return;
    var prev = trialState.sliderValues[idx];
    if (prev === value) return;
    trialState.sliderChangeCounts[idx]++;
    trialState.sliderValues[idx] = value;
    var elapsedSec = (performance.now() - trialState.roundStartTime) / 1000;
    trialState.sliderHistory.push({ idx: idx, from: prev, to: value, timeMs: elapsedSec * 1000 });
    /* former_exp 互換の CSV 履歴: 値と時間を issue 別に追記 */
    trialState.posHistoryStr[idx]  += value + ',';
    trialState.timeHistoryStr[idx] += elapsedSec.toFixed(3) + ',';
    /* 全スライダーのスナップショットを記録 */
    trialState.positionsFull.push(trialState.sliderValues.slice());
    if (PARAMS.showRemainingCount) {
      var remaining = PARAMS.maxChangesPerSlider - trialState.sliderChangeCounts[idx];
      var slot = screenTrial.querySelector('.lane-remaining[data-idx="' + idx + '"]');
      if (slot) {
        var n = slot.querySelector('.remaining-num');
        if (n) n.textContent = String(remaining);
        slot.classList.toggle('exhausted', remaining <= 0);
      }
      if (remaining <= 0) lockSlider(idx);
    }
  }

  function onPropose() {
    if (!trialState || trialState.hasProposed) return;
    trialState.hasProposed = true;
    trialState.proposedAt = performance.now();
    var xs = trialState.sliderValues.slice();
    var res = determineExpression(xs);
    trialState.agentExpression = res.expr;
    trialState.utility = res.u;
    trialState.proposal = xs.slice();   // 提案ボタン押下時の配分を凍結

    /* 本試行のみ: 提案ボタン押下時点で即座に Qualtrics に保存
     * (途中離脱対策。各試行のオファーが落ちないように)
     */
    if (phase === 'main' && typeof Qualtrics !== 'undefined') {
      var i = trialState.trialIndex;
      var sed = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
      sed('trial' + i + '_proposal',      xs.join(','));
      sed('trial' + i + '_offer_issue1',  xs[0]);
      sed('trial' + i + '_offer_issue2',  xs[1]);
      sed('trial' + i + '_offer_issue3',  xs[2]);
      sed('trial' + i + '_expression',    res.expr);
      sed('trial' + i + '_proposed_at_ms', (trialState.proposedAt - trialState.roundStartTime).toFixed(1));
    }

    /* 同一画面で post-propose 状態へ */
    setAgentExpression(res.expr);
    lockAllSliders();
    var recTitle = $sel('.rec-title', screenTrial);
    if (recTitle) recTitle.textContent = '美咲の反応をご確認ください';
    var proposeBtn = $sel('.propose-btn', screenTrial);
    if (proposeBtn) proposeBtn.style.display = 'none';
    var nextBtn = $sel('.next-btn', screenTrial);
    var timerNote = $sel('.timer-note', screenTrial);

    /* 評定パネルを表示し、ラジオの change を監視。
     * 「次へ」は (5秒タイマー終了) かつ (評定選択済み) の AND で活性化。
     */
    var ratingPanel = $sel('.rating-panel', screenTrial);
    if (ratingPanel) ratingPanel.style.display = '';

    var timerDone = false;
    var ratingChosen = false;
    function updateNextBtn() {
      if (!nextBtn) return;
      nextBtn.disabled = !(timerDone && ratingChosen);
      if (timerNote) {
        if (!timerDone) return;
        if (!ratingChosen) {
          timerNote.textContent = '美咲にとって良い提案だったかを評定してください';
        } else {
          timerNote.textContent = '次へ進めます';
        }
      }
    }
    var ratingInputs = screenTrial.querySelectorAll('input[name="goodness-rating"]');
    for (var ri = 0; ri < ratingInputs.length; ri++) {
      (function (rEl) {
        rEl.addEventListener('change', function () {
          if (rEl.checked) {
            ratingChosen = true;
            if (trialState) trialState.goodnessRating = parseInt(rEl.value, 10);
            updateNextBtn();
          }
        });
      })(ratingInputs[ri]);
    }

    if (nextBtn) {
      nextBtn.style.display = ''; nextBtn.disabled = true;
      var secs = Math.ceil(PARAMS.minViewDurationMs / 1000);
      if (timerNote) timerNote.textContent = '表情を確認してください(' + secs + '秒後に次へ進めます)';
      clearInterval(viewTimerHandle);
      viewTimerHandle = setInterval(function () {
        secs--;
        if (secs <= 0) {
          clearInterval(viewTimerHandle); viewTimerHandle = null;
          timerDone = true;
          updateNextBtn();
        } else {
          if (timerNote) timerNote.textContent = '表情を確認してください(' + secs + '秒後に次へ進めます)';
        }
      }, 1000);
    }
  }

  function endTrial() {
    if (!trialState) return;
    trialState.nextClickedAt = performance.now();
    if (phase === 'main') {
      trialStates.push({
        trial_index: trialState.trialIndex,
        recommendation: trialState.recommendation.slice(),
        proposal: trialState.sliderValues.slice(),
        expression: trialState.agentExpression,
        goodness_rating: trialState.goodnessRating,    // 美咲にとっての提案の良さ (1〜7, 未回答は null)
        propose_time_ms: trialState.proposedAt - trialState.roundStartTime,
        view_time_ms: trialState.nextClickedAt - trialState.proposedAt,
        slider_change_count: trialState.sliderChangeCounts.slice(),
        /* スライダー履歴 (former_exp.js 互換) */
        pos_history_str:  trialState.posHistoryStr.slice(),     // ['0,1,2,', ...]
        time_history_str: trialState.timeHistoryStr.slice(),    // ['1.234,2.345,', ...]
        positions_full:   trialState.positionsFull.slice(),     // [[0,0,0],[1,0,0],...]
        utility: trialState.utility,
        match_recommendation: trialState.recommendation.every(function (r, i) {
          return Math.abs(r - trialState.sliderValues[i]) <= PARAMS.matchTolerance;
        }) ? 1 : 0
      });
    }
  }

  function enterTrial() {
    startTrial(currentTrial);
    attachAgent(screenTrial);
    renderTrialScreen();
    showBlock('screen-trial');
    /* Live2D 初期化(初回のみ) */
    if (!live2dReady && !window.IndexLibrary) {
      requestAnimationFrame(function () {
        loadLive2DResource(0, function () {
          if (window.IndexLibrary) initLive2D();
        });
      });
    } else if (!live2dReady && window.IndexLibrary) {
      initLive2D();
    }
  }

  /* ============================================================
   * 9. ボタンハンドラ群
   * ============================================================ */

  /* 「実験の概要」「美咲について」のブロックハンドラは別 Question 側で扱うため削除。
   * このスクリプトは block-practice-intro の「練習を始める」から起動する。
   */

  document.getElementById('btn-practice-start').addEventListener('click', function () {
    phase = 'practice';
    currentTrial = 1;
    var pb = document.getElementById('practice-badge');
    if (pb) pb.style.display = 'inline-block';
    enterTrial();
  });

  document.getElementById('btn-main-start').addEventListener('click', function () {
    phase = 'main';
    currentTrial = 1;
    trialStates = [];
    var pb = document.getElementById('practice-badge');
    if (pb) pb.style.display = 'none';
    enterTrial();
  });

  /* 提案ボタンの 3 状態画像 + クリック */
  var proposeBtnEl = screenTrial.querySelector('.propose-btn');
  var proposeBtnImgEl = proposeBtnEl.querySelector('img');
  if (proposeBtnImgEl) proposeBtnImgEl.src = PROPOSE_BTN_IMG.normal;
  proposeBtnEl.addEventListener('mouseover', function () {
    if (!proposeBtnEl.disabled) proposeBtnImgEl.src = PROPOSE_BTN_IMG.bright;
  });
  proposeBtnEl.addEventListener('mouseout', function () {
    if (!proposeBtnEl.disabled) proposeBtnImgEl.src = PROPOSE_BTN_IMG.normal;
  });
  proposeBtnEl.addEventListener('click', function () {
    proposeBtnImgEl.src = PROPOSE_BTN_IMG.pushed;
    setTimeout(function () { proposeBtnImgEl.src = PROPOSE_BTN_IMG.normal; }, 500);
    onPropose();
  });

  screenTrial.querySelector('.next-btn').addEventListener('click', function () {
    endTrial();
    currentTrial++;
    var total = (phase === 'practice') ? practiceRecs.length : PARAMS.T;
    if (currentTrial > total) {
      if (phase === 'practice') {
        showBlock('block-practice-done');
      } else {
        /* 本試行 6 回終了 → Embedded Data 書出 → 次の Qualtrics Question へ */
        finalizeAndAdvance();
      }
      return;
    }
    enterTrial();
  });

  /* ============================================================
   * 10. 本試行終了時: Embedded Data 書出し → 次の Question へ
   * (w 推定 / 事後質問 / デブリーフィングは別 Question で実装済み)
   * ============================================================ */

  function finalizeAndAdvance() {
    var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };

    /* 試行ログ
     * 提案配分 (proposal / offer_issue{j}) と表情は onPropose 時にも書いたが、
     * 念のためここでも上書き保存。スライダー履歴は最終時点でまとめて保存。
     */
    var nonComplianceCount = 0;
    trialStates.forEach(function (t) {
      var i = t.trial_index;

      /* 推薦 / 提案 / 表情 */
      setED('trial' + i + '_recommendation', t.recommendation.join(','));
      setED('trial' + i + '_proposal',       t.proposal.join(','));
      setED('trial' + i + '_offer_issue1',   t.proposal[0]);
      setED('trial' + i + '_offer_issue2',   t.proposal[1]);
      setED('trial' + i + '_offer_issue3',   t.proposal[2]);
      setED('trial' + i + '_expression',     t.expression);

      /* タイミング */
      setED('trial' + i + '_propose_time_ms', t.propose_time_ms.toFixed(1));
      setED('trial' + i + '_view_time_ms',    t.view_time_ms.toFixed(1));

      /* スライダー操作回数 */
      setED('trial' + i + '_slider_changes',     t.slider_change_count.join(','));
      setED('trial' + i + '_slider1_changes_n',  t.slider_change_count[0]);
      setED('trial' + i + '_slider2_changes_n',  t.slider_change_count[1]);
      setED('trial' + i + '_slider3_changes_n',  t.slider_change_count[2]);

      /* スライダー履歴 (former_exp.js 互換: issue 別 CSV 文字列)
       * 形式: "0,1,2,3," (初期値 + 各操作後の値, 末尾カンマ)
       */
      setED('trial' + i + '_pos_issue1',  t.pos_history_str[0]);
      setED('trial' + i + '_pos_issue2',  t.pos_history_str[1]);
      setED('trial' + i + '_pos_issue3',  t.pos_history_str[2]);

      /* 各操作のタイムスタンプ (試行開始からの秒数, 小数 3 桁)
       * 形式: "1.234,2.456,"
       */
      setED('trial' + i + '_time_issue1', t.time_history_str[0]);
      setED('trial' + i + '_time_issue2', t.time_history_str[1]);
      setED('trial' + i + '_time_issue3', t.time_history_str[2]);

      /* 全 3 スライダーのスナップショット履歴 (JSON)
       * 形式: "[[0,0,0],[1,0,0],[1,2,0],...]"
       */
      setED('trial' + i + '_positions_history', JSON.stringify(t.positions_full));

      setED('trial' + i + '_match_recommendation', t.match_recommendation);

      /* 7段階評定 (1〜7, 未回答は空文字) */
      setED('trial' + i + '_goodness_rating', (t.goodness_rating !== null && t.goodness_rating !== undefined) ? t.goodness_rating : '');

      if (!t.match_recommendation) nonComplianceCount++;
    });
    setED('noncompliance_rate', trialStates.length ? nonComplianceCount / trialStates.length : 0);

    /* 条件パラメータ */
    setED('theta_deg',      theta_deg);
    setED('c_value',        c_value);
    setED('delta_plus',     delta_plus);
    setED('delta_minus',    delta_minus);
    setED('tau_thresholds', tau_thresholds.map(function (t) { return t.toFixed(4); }).join(','));
    setED('u_max_beta',     u_max);
    setED('u_min_beta',     u_min);

    /* タイミング */
    setED('total_task_time_ms', (performance.now() - sessionStartTime).toFixed(1));
    setED('started_at_iso',     sessionStartedAtIso);
    setED('finished_at_iso',    new Date().toISOString());

    /* 次の Qualtrics Question (w 推定 / 事後質問 / デブリーフィング) へ進む */
    that.clickNextButton();
  }

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
