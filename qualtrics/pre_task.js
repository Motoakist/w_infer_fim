/* ============================================================
 * NeurIPS2026 実験 — タスク事前説明 + 理解度チェック + 注意確認
 * Qualtrics Question JavaScript
 *
 * 内容:
 *  1. Embedded Data (cond_theta, item images) の取得
 *  2. ブロック切替 (説明 6 ページ → 性格教示 → 理解度 9 問 → 事前注意確認)
 *  3. 性格条件に応じた表強調 + 教示文の動的差替え
 *  4. 理解度チェックの全問正解判定 + 失敗時のリトライ
 *  5. 事前注意確認 (Instructed-response item)
 *  6. Embedded Data 書出 → clickNextButton() で主実験 Question へ
 * ============================================================ */

Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';

  var that = this;
  this.hideNextButton();

  /* ============================================================
   * 1. Embedded Data 読込
   * ============================================================ */

  function $val(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var v = el.value;
    if (!v) return fallback;
    /* リテラル "${" を書けないので文字コードで判定
     * 36 = ドル記号, 123 = 波カッコ開
     */
    if (v.charCodeAt(0) === 36 && v.charCodeAt(1) === 123) return fallback;
    return v;
  }

  var THETA_BY_CONDITION = {
    competitive:    -45,
    individualistic:  0,
    cooperative:     45,
    altruistic:      90
  };
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

  var cond_theta = $val('pretask_emb_cond_theta', null);
  if (!THETA_BY_CONDITION.hasOwnProperty(cond_theta)) {
    cond_theta = pickRandom(Object.keys(THETA_BY_CONDITION));
  }

  /* アイテム画像を <img> へ反映 */
  var item1 = $val('pretask_emb_issue1_img', 'https://via.placeholder.com/80?text=1');
  var item2 = $val('pretask_emb_issue2_img', 'https://via.placeholder.com/80?text=2');
  var item3 = $val('pretask_emb_issue3_img', 'https://via.placeholder.com/80?text=3');
  var img1 = document.getElementById('pretask-item1-img');
  var img2 = document.getElementById('pretask-item2-img');
  var img3 = document.getElementById('pretask-item3-img');
  if (img1) img1.src = item1;
  if (img2) img2.src = item2;
  if (img3) img3.src = item3;

  /* 性格教示の表ハイライト + 教示文 */
  (function applyThetaInstruction() {
    var labelEl = document.getElementById('pretask-theta-label');
    var instrEl = document.getElementById('pretask-theta-instruction');
    if (labelEl) labelEl.textContent = THETA_LABEL[cond_theta] || '?';
    if (instrEl) instrEl.innerHTML = THETA_INSTRUCTIONS[cond_theta] || '';
    var rowId = 'pretask-theta-row-' + cond_theta;
    var row = document.getElementById(rowId);
    if (row) row.classList.add('highlighted');
  })();

  /* ============================================================
   * 2. ブロック切替
   * ============================================================ */

  var blocks = [
    'block-purpose','block-misaki','block-items','block-expression',
    'block-flow','block-ui','block-theta',
    'block-comprehension','block-comp-retry','block-attention','block-complete'
  ];

  var currentShownId = null;
  function showBlock(id) {
    var same = (currentShownId === id);
    currentShownId = id;
    blocks.forEach(function (b) {
      var el = document.getElementById(b);
      if (el) el.classList.toggle('active', b === id);
    });
    if (!same) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* data-next / data-prev 属性のボタンを汎用ハンドラで処理 */
  document.querySelectorAll('#pretask-app .pretask-next-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-next');
      if (next) showBlock(next);
    });
  });
  document.querySelectorAll('#pretask-app .pretask-prev-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prev = btn.getAttribute('data-prev');
      if (prev) showBlock(prev);
    });
  });

  /* ============================================================
   * 3. 理解度チェック
   * ============================================================ */

  /* 全問定義: id, correct (string or array), multi (bool) */
  var COMP_QUESTIONS = [
    { id: 1, correct: ['C'],         multi: false, label: 'タスクの目的',          backTo: 'block-purpose' },
    { id: 2, correct: ['B'],         multi: false, label: 'スライダー操作',        backTo: 'block-ui' },
    { id: 3, correct: ['C'],         multi: false, label: '試行回数',              backTo: 'block-flow' },
    { id: 4, correct: ['B'],         multi: false, label: 'AI の反応',             backTo: 'block-misaki' },
    { id: 5, correct: ['A'],         multi: false, label: '提案ボタン回数',        backTo: 'block-ui' },
    { id: 6, correct: ['A'],         multi: false, label: '6 回後の回答',          backTo: 'block-flow' },
    { id: 7, correct: ['A','B','C'], multi: true,  label: '表情変化の決定要因',     backTo: 'block-expression' },
    { id: 8, correct: ['B'],         multi: false, label: '性格の扱い',            backTo: 'block-expression' },
    { id: 9, correct: ['C'],         multi: false, label: '推奨されない行動',      backTo: 'block-purpose' }
  ];

  var compAttempts = 0;
  var compFirstScore = null;
  var lastCompResults = null;

  function getCompAnswers() {
    var answers = {};
    COMP_QUESTIONS.forEach(function (q) {
      var name = 'comp_q' + q.id;
      if (q.multi) {
        var checked = document.querySelectorAll('input[name="' + name + '"]:checked');
        var vals = [];
        for (var i = 0; i < checked.length; i++) vals.push(checked[i].value);
        answers[q.id] = vals.sort();
      } else {
        var sel = document.querySelector('input[name="' + name + '"]:checked');
        answers[q.id] = sel ? sel.value : null;
      }
    });
    return answers;
  }

  function isCorrect(q, answer) {
    if (q.multi) {
      if (!Array.isArray(answer)) return false;
      var correct = q.correct.slice().sort();
      if (answer.length !== correct.length) return false;
      for (var i = 0; i < correct.length; i++) {
        if (answer[i] !== correct[i]) return false;
      }
      return true;
    } else {
      return answer === q.correct[0];
    }
  }

  function evaluateComp() {
    var answers = getCompAnswers();
    var results = COMP_QUESTIONS.map(function (q) {
      var ans = answers[q.id];
      var unanswered = q.multi ? (!ans || ans.length === 0) : (ans === null);
      return {
        id: q.id,
        label: q.label,
        backTo: q.backTo,
        answer: q.multi ? (ans || []).join(',') : (ans || ''),
        correct: !unanswered && isCorrect(q, ans),
        unanswered: unanswered
      };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { results: results, score: score, total: COMP_QUESTIONS.length };
  }

  /* 理解度チェック送信 */
  document.getElementById('pretask-comp-submit').addEventListener('click', function () {
    compAttempts++;
    var ev = evaluateComp();
    lastCompResults = ev;

    /* 未回答チェック */
    var anyUnanswered = ev.results.some(function (r) { return r.unanswered; });
    if (anyUnanswered) {
      var resBox = document.getElementById('pretask-comp-result');
      if (resBox) {
        resBox.style.display = '';
        resBox.innerHTML = '<div class="result-banner fail">未回答の質問があります。すべて回答してください。</div>';
      }
      /* 未回答質問をハイライト */
      ev.results.forEach(function (r) {
        var qEl = document.querySelector('#pretask-comp-form .question[data-q="' + r.id + '"]');
        if (qEl) qEl.classList.toggle('error', r.unanswered);
      });
      return;
    }

    /* 1 回目の素点を保持 */
    if (compFirstScore === null) compFirstScore = ev.score;

    /* 各設問のフィードバック */
    ev.results.forEach(function (r) {
      var qEl = document.querySelector('#pretask-comp-form .question[data-q="' + r.id + '"]');
      if (!qEl) return;
      qEl.classList.toggle('correct', r.correct);
      qEl.classList.toggle('error', !r.correct);
    });

    /* 全問正解 → 注意確認へ */
    if (ev.score === ev.total) {
      var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
      setED('comprehension_score', ev.score);
      setED('comprehension_attempts', compAttempts);
      setED('comprehension_first_attempt_score', compFirstScore);
      ev.results.forEach(function (r) {
        setED('comprehension_q' + r.id, r.answer);
        setED('comprehension_q' + r.id + '_correct', r.correct ? 1 : 0);
      });
      showBlock('block-attention');
      return;
    }

    /* 不正解あり → リトライ画面へ
     * ただし 2 回目以降の不正解は強制スキップで進める(無限ループ防止)
     */
    if (compAttempts >= 2) {
      /* 2 回目も不正解 → 進めるが記録 */
      var setED2 = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
      setED2('comprehension_score', ev.score);
      setED2('comprehension_attempts', compAttempts);
      setED2('comprehension_first_attempt_score', compFirstScore);
      ev.results.forEach(function (r) {
        setED2('comprehension_q' + r.id, r.answer);
        setED2('comprehension_q' + r.id + '_correct', r.correct ? 1 : 0);
      });
      showBlock('block-attention');
      return;
    }

    /* 1 回目の不正解 → リトライ画面 */
    showRetry(ev);
  });

  function showRetry(ev) {
    var sumEl = document.getElementById('pretask-retry-score');
    var wrongCountEl = document.getElementById('pretask-retry-wrong-count');
    var listEl = document.getElementById('pretask-retry-wrong-list');
    if (sumEl) sumEl.textContent = String(ev.score);
    var wrongs = ev.results.filter(function (r) { return !r.correct; });
    if (wrongCountEl) wrongCountEl.textContent = String(wrongs.length);
    if (listEl) {
      listEl.innerHTML = wrongs.map(function (w) {
        return '<li>Q' + w.id + ': ' + w.label + '</li>';
      }).join('');
    }

    /* 次へボタンに backTo の最初のブロックを設定(誤答が多い説明から再読み) */
    var backTarget = wrongs.length > 0 ? wrongs[0].backTo : 'block-purpose';
    var nextBtn = document.querySelector('#block-comp-retry .pretask-next-btn');
    if (nextBtn) nextBtn.setAttribute('data-next', backTarget);

    /* 「直接戻る」ボタンで question セクションのみ戻れる */
    var skipBtn = document.getElementById('pretask-retry-skip');
    if (skipBtn) {
      skipBtn.onclick = function () {
        /* 質問のフィードバッククラスをクリアして再回答可能に */
        document.querySelectorAll('#pretask-comp-form .question').forEach(function (el) {
          el.classList.remove('correct'); el.classList.remove('error');
        });
        showBlock('block-comprehension');
      };
    }

    showBlock('block-comp-retry');
  }

  /* リトライ後に block-comprehension に戻ったとき、フィードバッククラスを掃除 */
  var origNextHandlers = document.querySelectorAll('#block-comp-retry .pretask-next-btn');
  origNextHandlers.forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#pretask-comp-form .question').forEach(function (el) {
        el.classList.remove('correct'); el.classList.remove('error');
      });
      var resBox = document.getElementById('pretask-comp-result');
      if (resBox) { resBox.style.display = 'none'; resBox.innerHTML = ''; }
      var attemptEl = document.getElementById('pretask-comprehension-attempt');
      if (attemptEl) attemptEl.textContent = '2 回目';
    });
  });

  /* ============================================================
   * 4. 事前注意確認 (Instructed-response)
   * ============================================================ */

  document.getElementById('pretask-attention-submit').addEventListener('click', function () {
    var sel = document.querySelector('input[name="attention_pre"]:checked');
    var qEl = document.getElementById('pretask-attention-q');
    if (!sel) {
      if (qEl) qEl.classList.add('error');
      return;
    }
    var pass = (sel.value === 'rarely') ? 1 : 0;

    var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
    setED('attention_pre_answer', sel.value);
    setED('attention_pre_pass',   pass);

    /* 完了画面へ */
    showBlock('block-complete');
  });

  /* ============================================================
   * 5. 完了 → 主実験 Question へ
   * ============================================================ */

  document.getElementById('pretask-complete-next').addEventListener('click', function () {
    that.clickNextButton();
  });

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
