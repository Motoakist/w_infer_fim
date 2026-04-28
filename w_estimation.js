/* Block 7 w 推定 のロジック
 * - 3スライダー、各 -2 〜 2 の整数 5段階
 * - 全スライダー操作で「確定する」を活性化（任意：初期値 0 のままでも OK にする運用も可）
 *
 * 依存: params.js
 */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const W_MIN = -2;
  const W_MAX = 2;
  const W_STEP = 1;
  const W_INITIAL = 0;

  const state = {
    values: [W_INITIAL, W_INITIAL, W_INITIAL],
    touched: [false, false, false],
  };

  function render(root) {
    const box = $('.w-sliders', root);
    if (!box) return;
    box.innerHTML = '';

    for (let i = 0; i < PARAMS.M; i++) {
      const row = document.createElement('div');
      row.className = 'w-slider-row';
      row.dataset.idx = String(i);
      row.innerHTML = `
        <label><strong>${ISSUE_LABELS[i]}</strong> をどの程度重視していると思いますか？</label>
        <div class="w-slider-scale">
          <span>-2 (嫌う)</span>
          <span>-1</span>
          <span>0 (無関心)</span>
          <span>+1</span>
          <span>+2 (重視)</span>
        </div>
        <input type="range" class="w-slider-input" min="${W_MIN}" max="${W_MAX}" step="${W_STEP}" value="${state.values[i]}" />
        <div class="w-slider-current">現在: <span class="cur">${state.values[i]}</span></div>
      `;
      box.appendChild(row);

      const input = row.querySelector('input');
      input.addEventListener('input', (ev) => {
        state.values[i] = parseInt(ev.target.value, 10);
        row.querySelector('.cur').textContent = String(state.values[i]);
        state.touched[i] = true;
        updateConfirmButton(root);
      });
    }

    updateConfirmButton(root);
  }

  function updateConfirmButton(root) {
    const btn = $('.confirm-w-btn', root);
    if (!btn) return;
    /* デフォルトでは初期値のままでも確定可能（要検討事項なので寛容な実装） */
    btn.disabled = false;
  }

  function getValues() {
    return state.values.slice();
  }

  function reset() {
    state.values = [W_INITIAL, W_INITIAL, W_INITIAL];
    state.touched = [false, false, false];
  }

  window.WEstimation = {
    render,
    getValues,
    reset,
    state,
  };
})();
