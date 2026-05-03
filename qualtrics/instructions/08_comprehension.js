/* ============================================================
 * Q-10 理解度チェック (9 問) — Qualtrics Question JavaScript
 *
 * 動作:
 *  - Qualtrics 標準の「次へ」ボタンを最初は非表示
 *  - 「回答を確認する」ボタンで全問チェック
 *  - 全問正解 → Embedded Data 保存 → clickNextButton() で次の Question へ
 *  - 不正解あり (1 回目) → 誤答箇所を赤くハイライト + 警告 → 再回答
 *  - 不正解あり (2 回目以降) → 不正解のまま記録して進行 (無限ループ防止)
 *
 * Embedded Data 出力:
 *   comprehension_q1〜q9, comprehension_q1_correct〜q9_correct,
 *   comprehension_score, comprehension_attempts,
 *   comprehension_first_attempt_score
 * ============================================================ */

Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';

  var that = this;
  this.hideNextButton();

  /* 全問定義 (HTML 側の data-* 属性と一致させる) */
  var COMP_QUESTIONS = [
    { id: 1, correct: ['C'],         multi: false },
    { id: 2, correct: ['B'],         multi: false },
    { id: 3, correct: ['C'],         multi: false },
    { id: 4, correct: ['B'],         multi: false },
    { id: 5, correct: ['A'],         multi: false },
    { id: 6, correct: ['A'],         multi: false },
    { id: 7, correct: ['A','B','C'], multi: true },
    { id: 8, correct: ['B'],         multi: false },
    { id: 9, correct: ['C'],         multi: false }
  ];

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
    document.querySelectorAll('#comp-form .nip-question').forEach(function (el) {
      el.classList.remove('correct'); el.classList.remove('error');
    });
    var banner = document.getElementById('comp-result-banner');
    if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
  }

  function showBanner(html, type) {
    var banner = document.getElementById('comp-result-banner');
    if (!banner) return;
    banner.style.display = '';
    banner.className = 'nip-result-banner ' + (type || 'fail');
    banner.innerHTML = html;
  }

  function saveAndAdvance(ev) {
    var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
    setED('comprehension_score', ev.score);
    setED('comprehension_attempts', compAttempts);
    setED('comprehension_first_attempt_score', compFirstScore);
    ev.results.forEach(function (r) {
      setED('comprehension_q' + r.id, r.answer);
      setED('comprehension_q' + r.id + '_correct', r.correct ? 1 : 0);
    });
    that.clickNextButton();
  }

  /* 「回答を確認する」ボタン */
  var submitBtn = document.getElementById('comp-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      compAttempts++;
      clearFeedback();
      var ev = evaluate();

      /* 未回答チェック */
      var anyUnanswered = ev.results.some(function (r) { return r.unanswered; });
      if (anyUnanswered) {
        ev.results.forEach(function (r) {
          if (r.unanswered) {
            var qEl = document.querySelector('#comp-form .nip-question[data-q="' + r.id + '"]');
            if (qEl) qEl.classList.add('error');
          }
        });
        showBanner('未回答の質問があります。すべて回答してください。', 'fail');
        compAttempts--;  /* 未回答は受験回数に数えない */
        return;
      }

      /* 1 回目の素点を保持 */
      if (compFirstScore === null) compFirstScore = ev.score;

      /* 各設問のフィードバック */
      ev.results.forEach(function (r) {
        var qEl = document.querySelector('#comp-form .nip-question[data-q="' + r.id + '"]');
        if (!qEl) return;
        qEl.classList.toggle('correct', r.correct);
        qEl.classList.toggle('error', !r.correct);
      });

      /* 全問正解 → 次の Question へ */
      if (ev.score === ev.total) {
        showBanner('全問正解です。次に進みます…', 'success');
        setTimeout(function () { saveAndAdvance(ev); }, 800);
        return;
      }

      /* 不正解あり */
      var wrongCount = ev.total - ev.score;
      if (compAttempts >= 2) {
        /* 2 回目以降の不正解 → 記録して進む(無限ループ防止) */
        showBanner(
          '不正解が ' + wrongCount + ' 問残っていますが、次に進みます。<br>' +
          'タスク中に説明を思い出しながら進めてください。',
          'fail'
        );
        setTimeout(function () { saveAndAdvance(ev); }, 1500);
        return;
      }

      /* 1 回目の不正解 → 再回答を促す */
      showBanner(
        '不正解が ' + wrongCount + ' 問あります。<br>' +
        '赤枠の質問を見直して、もう一度回答してください。',
        'fail'
      );
      var attemptEl = document.getElementById('comp-attempt-label');
      if (attemptEl) attemptEl.textContent = '2 回目';

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
