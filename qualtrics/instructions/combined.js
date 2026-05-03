/* 統合版 (01〜08): CSS と理解度チェック form をこの JS から動的注入する */
Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';
  var that = this;
  this.hideNextButton();

  /* CSS 注入 */
  (function injectStyle() {
    var css = ''
      + '#ins-app *{box-sizing:border-box;}'
      + '#ins-app{font-family:"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;color:#222;line-height:1.7;max-width:880px;margin:0 auto;padding:16px;}'
      + '#ins-app .block{display:none;}'
      + '#ins-app .block.active{display:block;}'
      + '#ins-app .card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:32px;margin:16px 0;}'
      + '#ins-app h2{margin-top:0;color:#1a1a1a;border-bottom:3px solid #2563eb;padding-bottom:8px;}'
      + '#ins-app p{font-size:16px;}'
      + '#ins-app .progress{text-align:right;font-size:13px;color:#6b7280;margin-bottom:8px;}'
      + '#ins-app .btn{display:inline-block;padding:12px 28px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:background-color .15s;margin:0 6px;}'
      + '#ins-app .btn:hover:not(:disabled){background:#1d4ed8;}'
      + '#ins-app .btn:disabled{background:#9ca3af;cursor:not-allowed;}'
      + '#ins-app .btn-secondary{background:#6b7280;}'
      + '#ins-app .btn-secondary:hover:not(:disabled){background:#4b5563;}'
      + '#ins-app .actions{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;}'
      + '#ins-app .info-box{background:#eff6ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin:16px 0;}'
      + '#ins-app .warn-box{background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:6px;margin:16px 0;}'
      + '#ins-app .note-box{background:#f3f4f6;border-left:4px solid #6b7280;padding:12px 16px;border-radius:6px;margin:16px 0;font-size:14px;}'
      + '#ins-app .expression-list{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:16px 0;list-style:none;padding:0;}'
      + '#ins-app .expression-list li{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;min-width:90px;}'
      + '#ins-app .expression-list .emoji{font-size:28px;display:block;}'
      + '#ins-app .expression-list .label{font-size:12px;color:#4b5563;margin-top:4px;}'
      + '#ins-app .item-row{display:flex;justify-content:center;gap:32px;margin:20px 0;flex-wrap:wrap;}'
      + '#ins-app .item-cell{text-align:center;}'
      + '#ins-app .item-cell img{width:80px;height:80px;display:block;margin:0 auto 8px;object-fit:contain;}'
      + '#ins-app .item-cell .item-count{font-size:14px;color:#6b7280;}'
      + '#ins-app .flow-list{counter-reset:step;list-style:none;padding:0;}'
      + '#ins-app .flow-list>li{counter-increment:step;position:relative;padding:12px 12px 12px 56px;margin-bottom:8px;background:#f9fafb;border-radius:8px;font-size:16px;}'
      + '#ins-app .flow-list>li::before{content:counter(step);position:absolute;left:12px;top:12px;background:#2563eb;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;}'
      + '#ins-app .theta-table{width:100%;border-collapse:collapse;margin:16px 0;}'
      + '#ins-app .theta-table th,#ins-app .theta-table td{border:1px solid #d1d5db;padding:10px 14px;text-align:left;}'
      + '#ins-app .theta-table th{background:#f3f4f6;font-weight:700;}'
      + '#ins-app .theta-table .highlighted{background:#fef3c7;font-weight:700;}'
      + '#ins-app .ui-figure{display:flex;justify-content:center;margin:16px 0;}'
      + '#ins-app .ui-figure-placeholder{border:2px dashed #d1d5db;padding:32px;border-radius:8px;text-align:center;color:#6b7280;width:100%;max-width:600px;}'
      + '#ins-app .question{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:16px;}'
      + '#ins-app .question.error{border-color:#f87171;background:#fef2f2;}'
      + '#ins-app .question.correct{border-color:#34d399;background:#f0fdf4;}'
      + '#ins-app .question .q-label{font-weight:700;margin-bottom:12px;font-size:16px;}'
      + '#ins-app .question .q-hint{font-size:13px;color:#6b7280;margin-bottom:8px;}'
      + '#ins-app .choice-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;}'
      + '#ins-app .choice-list label{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;cursor:pointer;border-radius:4px;border:2px solid transparent;transition:all .15s;}'
      + '#ins-app .choice-list label:hover{background:#f9fafb;}'
      + '#ins-app .choice-list label.selected{background:#dbeafe;border-color:#2563eb;font-weight:600;}'
      + '#ins-app .choice-list input{margin-top:4px;}'
      + '#ins-app .result-banner{text-align:center;padding:20px;border-radius:8px;margin:16px 0;font-size:18px;font-weight:700;}'
      + '#ins-app .result-banner.success{background:#d1fae5;color:#065f46;border:2px solid #34d399;}'
      + '#ins-app .result-banner.fail{background:#fee2e2;color:#991b1b;border:2px solid #f87171;}';
    var styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.appendChild(document.createTextNode(css));
    document.head.appendChild(styleEl);
  })();

  /* Embedded Data 読込 (未置換 Piped Text を文字コード 36='$', 123='{' で検出) */
  function $val(id, fallback) {
    var el = document.getElementById(id), v = el && el.value;
    if (!v) return fallback;
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

  var cond_theta = $val('ins_emb_cond_theta', null);
  if (!THETA_LABEL.hasOwnProperty(cond_theta)) {
    cond_theta = pickRandom(Object.keys(THETA_LABEL));
  }

  /* アイテム画像は combined.html 内で直接 ${e://Field/issueN_img} を src 属性に
   * 埋め込んでサーバ側置換させているため、JS 側での処理は不要。
   */

  /* 性格教示の表ハイライト + 教示文 */
  (function applyThetaInstruction() {
    var labelEl = document.getElementById('ins-theta-label');
    var instrEl = document.getElementById('ins-theta-instruction');
    if (labelEl) labelEl.textContent = THETA_LABEL[cond_theta] || '?';
    if (instrEl) instrEl.innerHTML = THETA_INSTRUCTIONS[cond_theta] || '';
    var rowId = 'ins-theta-row-' + cond_theta;
    var row = document.getElementById(rowId);
    if (row) row.classList.add('highlighted');
  })();

  /* 理解度チェック form を JS から生成 */
  var COMP_QUESTIONS = [
    {
      id: 1, correct: ['C'], multi: false,
      label: 'このタスクの目的は何ですか?',
      choices: [
        { v: 'A', t: '美咲の性格を推定する' },
        { v: 'B', t: '美咲が好きな表情を選ぶ' },
        { v: 'C', t: '美咲が各アイテムをどの程度好んでいるかを推定する' },
        { v: 'D', t: '美咲を喜ばせる配分を提案する' }
      ]
    },
    {
      id: 2, correct: ['B'], multi: false,
      label: 'スライダーはどう動かしますか?',
      choices: [
        { v: 'A', t: '自由に好きな配分に動かす' },
        { v: 'B', t: '画面に表示された「試していただきたい配分」通りに動かす' },
        { v: 'C', t: '美咲が喜びそうな配分に動かす' },
        { v: 'D', t: 'ランダムに動かす' }
      ]
    },
    {
      id: 3, correct: ['C'], multi: false,
      label: 'タスクは何試行ありますか?(練習を除く)',
      choices: [
        { v: 'A', t: '1 試行' },
        { v: 'B', t: '3 試行' },
        { v: 'C', t: '6 試行' },
        { v: 'D', t: '10 試行' }
      ]
    },
    {
      id: 4, correct: ['B'], multi: false,
      label: '美咲はあなたの提案にどう反応しますか?',
      choices: [
        { v: 'A', t: '声を出して反応する' },
        { v: 'B', t: '表情を変える' },
        { v: 'C', t: '文字でメッセージを返す' },
        { v: 'D', t: '何も反応しない' }
      ]
    },
    {
      id: 5, correct: ['A'], multi: false,
      label: '各試行で「提案する」ボタンは何回押せますか?',
      choices: [
        { v: 'A', t: '1 回のみ' },
        { v: 'B', t: '3 回まで' },
        { v: 'C', t: '5 回まで' },
        { v: 'D', t: '何回でも' }
      ]
    },
    {
      id: 6, correct: ['A'], multi: false,
      label: '6 回の観察の後、何を答えますか?',
      choices: [
        { v: 'A', t: '美咲が各アイテムをどの程度重視しているか' },
        { v: 'B', t: '美咲の性格' },
        { v: 'C', t: '美咲が一番見せた表情' },
        { v: 'D', t: '何も答えない' }
      ]
    },
    {
      id: 7, correct: ['A','B','C'], multi: true,
      label: '美咲の表情の変化は何によって決まりますか?(<strong>複数選択</strong>)',
      hint: '該当するものを<strong>すべて</strong>選んでください。',
      choices: [
        { v: 'A', t: '美咲の性格' },
        { v: 'B', t: 'あなたが提案した配分' },
        { v: 'C', t: '美咲の各アイテムへの好み(重み)' },
        { v: 'D', t: '試行回数' },
        { v: 'E', t: '経過時間' }
      ]
    },
    {
      id: 8, correct: ['B'], multi: false,
      label: '美咲の性格について正しいものは?',
      choices: [
        { v: 'A', t: '性格は試行ごとにランダムに変わる' },
        { v: 'B', t: '性格は実験の最初に教えられ、表情の変わり方を決める' },
        { v: 'C', t: '性格は表情から推定する対象である' },
        { v: 'D', t: 'すべての参加者で同じ性格' }
      ]
    },
    {
      id: 9, correct: ['C'], multi: false,
      label: 'このタスクで<strong>すべきでない</strong>ことはどれですか?',
      choices: [
        { v: 'A', t: 'スライダーを推薦値通りに動かす' },
        { v: 'B', t: '美咲の表情を 5 秒以上観察する' },
        { v: 'C', t: '推薦値とは違う配分を提案する' },
        { v: 'D', t: '美咲の表情の変化に注目する' }
      ]
    }
  ];

  /* HTML エスケープ (q.label / q.choice.t は HTML を含むので最低限の保護) */
  function buildCompForm() {
    var html = '';
    COMP_QUESTIONS.forEach(function (q) {
      html += '<div class="question" data-q="' + q.id + '">';
      html += '<div class="q-label">Q' + q.id + '. ' + q.label + '</div>';
      if (q.hint) html += '<div class="q-hint">' + q.hint + '</div>';
      html += '<ul class="choice-list">';
      var inputType = q.multi ? 'checkbox' : 'radio';
      q.choices.forEach(function (c) {
        html += '<li><label><input type="' + inputType + '" name="comp_q' + q.id + '" value="' + c.v + '">' + c.v + '. ' + c.t + '</label></li>';
      });
      html += '</ul></div>';
    });
    var container = document.getElementById('ins-comp-form-container');
    if (container) container.innerHTML = html;
  }
  buildCompForm();

  /* 選択肢のハイライト: 選択中の input の親 label に .selected を付与 */
  (function () {
    var form = document.getElementById('ins-comp-form');
    if (!form) return;
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      var siblings = form.querySelectorAll('input[name="' + t.name + '"]');
      for (var i = 0; i < siblings.length; i++) {
        var l = siblings[i].closest('label');
        if (l) l.classList.toggle('selected', siblings[i].checked);
      }
    });
  })();

  /* ブロック切替 */
  var blocks = [
    'block-purpose','block-misaki','block-items','block-expression',
    'block-flow','block-ui','block-theta','block-comprehension'
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

  document.querySelectorAll('#ins-app .ins-next-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-next');
      if (next) showBlock(next);
    });
  });
  document.querySelectorAll('#ins-app .ins-prev-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prev = btn.getAttribute('data-prev');
      if (prev) showBlock(prev);
    });
  });

  /* 理解度チェック ロジック */
  var compAttempts = 0;
  var compFirstScore = null;

  function getAnswers() {
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

  function evaluate() {
    var answers = getAnswers();
    var results = COMP_QUESTIONS.map(function (q) {
      var ans = answers[q.id];
      var unanswered = q.multi ? (!ans || ans.length === 0) : (ans === null);
      return {
        id: q.id,
        answer: q.multi ? (ans || []).join(',') : (ans || ''),
        correct: !unanswered && isCorrect(q, ans),
        unanswered: unanswered
      };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { results: results, score: score, total: COMP_QUESTIONS.length };
  }

  function clearFeedback() {
    document.querySelectorAll('#ins-comp-form .question').forEach(function (el) {
      el.classList.remove('correct'); el.classList.remove('error');
    });
    var resBox = document.getElementById('ins-comp-result');
    if (resBox) { resBox.style.display = 'none'; resBox.innerHTML = ''; }
  }

  function showCompBanner(html, type) {
    var resBox = document.getElementById('ins-comp-result');
    if (!resBox) return;
    resBox.style.display = '';
    resBox.className = 'result-banner ' + (type || 'fail');
    resBox.innerHTML = html;
  }

  function saveAndAdvance(ev) {
    var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
    setED('comprehension_score', ev.score);
    setED('comprehension_attempts', compAttempts);
    setED('comprehension_first_attempt_score', compFirstScore);
    var wrongIds = [];
    ev.results.forEach(function (r) {
      setED('comprehension_q' + r.id, r.answer);
      setED('comprehension_q' + r.id + '_correct', r.correct ? 1 : 0);
      if (!r.correct) wrongIds.push(r.id);
    });
    /* 全問正解なら attention_check = 'true', 1問でも誤答なら 'false' */
    setED('comprehension_wrong_questions', wrongIds.join(','));
    setED('attention_check', (ev.score === ev.total) ? 'true' : 'false');
    that.clickNextButton();
  }

  var submitBtn = document.getElementById('ins-comp-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      compAttempts++;
      clearFeedback();
      var ev = evaluate();

      /* 未回答チェックのみ: 全部答えていなければ警告して同ページ留まり */
      var anyUnanswered = ev.results.some(function (r) { return r.unanswered; });
      if (anyUnanswered) {
        ev.results.forEach(function (r) {
          if (r.unanswered) {
            var qEl = document.querySelector('#ins-comp-form .question[data-q="' + r.id + '"]');
            if (qEl) qEl.classList.add('error');
          }
        });
        showCompBanner('未回答の質問があります。すべて回答してください。', 'fail');
        compAttempts--;
        return;
      }

      compFirstScore = ev.score;

      /* 各設問のフィードバックを表示(参加者に正誤がわかるように) */
      ev.results.forEach(function (r) {
        var qEl = document.querySelector('#ins-comp-form .question[data-q="' + r.id + '"]');
        if (!qEl) return;
        qEl.classList.toggle('correct', r.correct);
        qEl.classList.toggle('error', !r.correct);
      });

      /* 全問正解でも誤答ありでも、必ず次に進む(アテンションチェックの位置づけ) */
      if (ev.score === ev.total) {
        showCompBanner('全問正解です。次に進みます…', 'success');
      } else {
        showCompBanner(
          ev.score + ' / ' + ev.total + ' 問正解。次に進みます…',
          'fail'
        );
      }
      setTimeout(function () { saveAndAdvance(ev); }, 1200);
    });
  }

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
