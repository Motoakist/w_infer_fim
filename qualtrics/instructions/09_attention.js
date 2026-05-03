/* ============================================================
 * Q-11 事前注意確認 (Instructed-response) — Qualtrics Question JavaScript
 *
 * 動作:
 *  - Qualtrics 標準の「次へ」ボタンを最初は非表示
 *  - 「回答する」ボタンで判定
 *  - 「あまり話さない」(rarely) を選んだ場合は通過 (attention_pre_pass = 1)
 *  - 他の選択肢の場合は通過扱いではないが、そのまま進行 (除外は解析時に判定)
 *
 * Embedded Data 出力:
 *   attention_pre_answer  : 選んだ値 (rarely / sometimes / very_often / ...)
 *   attention_pre_pass    : 1 (rarely を選んだ) / 0 (それ以外)
 * ============================================================ */

Qualtrics.SurveyEngine.addOnload(function () {
  'use strict';

  var that = this;
  this.hideNextButton();

  var submitBtn = document.getElementById('att-submit-btn');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', function () {
    var sel = document.querySelector('input[name="attention_pre"]:checked');
    var qEl = document.getElementById('att-q');
    var banner = document.getElementById('att-result-banner');

    if (!sel) {
      if (qEl) qEl.classList.add('error');
      if (banner) {
        banner.style.display = '';
        banner.className = 'nip-result-banner fail';
        banner.innerHTML = '回答を選択してください。';
      }
      return;
    }

    var pass = (sel.value === 'rarely') ? 1 : 0;

    var setED = function (k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); };
    setED('attention_pre_answer', sel.value);
    setED('attention_pre_pass',   pass);

    /* 通過しても不通過でも次へ進む(除外判定は解析時) */
    if (banner) {
      banner.style.display = '';
      banner.className = 'nip-result-banner success';
      banner.innerHTML = '回答を受け付けました。次に進みます…';
    }
    submitBtn.disabled = true;
    setTimeout(function () { that.clickNextButton(); }, 600);
  });

});

Qualtrics.SurveyEngine.addOnReady(function () { });
Qualtrics.SurveyEngine.addOnUnload(function () { });
