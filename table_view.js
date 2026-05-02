/* テーブル + アイテム配置 + 垂直スライダー
 *
 * 設計上のポイント：
 * - シンプルな長方形テーブル(SVG)。台形による奥行き演出は廃止。
 * - 3 つのレーン(論点)は等間隔に水平配置し、各レーンには垂直スライダーを置く。
 * - スライダーは writing-mode: vertical-lr で素直に垂直化(回転なし)。
 * - アイテムは絶対配置で重ね描き、最大値ぶん事前生成して可視/不可視で表現
 *   → 値変化でレイアウトが変わらず、スライダーの位置がブレない。
 * - 論点ラベル(「論点1」等)は廃止。アイテム画像で識別する。
 * - 残り操作回数表示は PARAMS.showRemainingCount で JS から切替可能。
 *
 * API:
 *   TableView.render(rootEl, {
 *     issueLabels, itemImages, itemMax, initialValues,
 *     onChange: (idx, value) => {}, onInput: (idx, value) => {}
 *   })
 *   TableView.setValue(idx, value)
 *   TableView.lockSlider(idx)
 *   TableView.lockAllSliders()
 */

(function () {
  'use strict';

  /* ===== ジオメトリ =====
   * 長方形テーブル。レーンは等間隔に水平配置(回転なし)。
   */
  const TABLE_WIDTH  = 720;
  const TABLE_HEIGHT = 360;

  /* レーン中央の X 座標 */
  function laneX(idx, total) {
    return TABLE_WIDTH * (idx + 1) / (total + 1);
  }

  let state = null; // { rootEl, opts, lanes:[] }

  function render(rootEl, opts) {
    const num = opts.issueLabels.length;
    const max = opts.itemMax;
    const recommendation = opts.recommendation || [];
    const showRemaining = (typeof PARAMS !== 'undefined') && !!PARAMS.showRemainingCount;

    rootEl.innerHTML = `
      <div class="table-3d">
        <div class="table-side-label opponent">\u2191 \u7f8e\u54b2(\u5965)</div>
        <svg class="table-3d-svg" viewBox="0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}" preserveAspectRatio="none">
          <rect x="0" y="0" width="${TABLE_WIDTH}" height="${TABLE_HEIGHT}" />
        </svg>
        <div class="lanes"></div>
        <div class="table-side-label self">\u2193 \u3042\u306a\u305f(\u624b\u524d)</div>
      </div>
    `;

    const lanesEl = rootEl.querySelector('.lanes');
    state = { rootEl, opts, lanes: [] };

    for (let i = 0; i < num; i++) {
      const cx = laneX(i, num);
      const leftPct = (cx / TABLE_WIDTH) * 100;

      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.idx = String(i);
      lane.style.left = `calc(${leftPct}% - 50px)`;
      const remainingHtml = showRemaining
        ? `<div class="lane-remaining" data-idx="${i}">残り <span class="remaining-num">${opts.maxChanges ?? '-'}</span> 回</div>`
        : '';
      lane.innerHTML = `
        <div class="opp-stack" data-idx="${i}"></div>
        <input type="range" class="lane-slider" min="0" max="${max}" step="1"
               value="${opts.initialValues[i] ?? 0}" data-idx="${i}" />
        ${remainingHtml}
        <div class="self-stack" data-idx="${i}"></div>
      `;
      lanesEl.appendChild(lane);

      /* アイテムを最大数ぶん事前配置(可視/不可視で枚数を表現) */
      const oppStack  = lane.querySelector('.opp-stack');
      const selfStack = lane.querySelector('.self-stack');
      for (let j = 0; j < max; j++) {
        const im1 = document.createElement('img');
        im1.src = opts.itemImages[i];
        im1.alt = opts.issueLabels[i];
        im1.className = 'item-img opp-item-img';
        oppStack.appendChild(im1);

        const im2 = document.createElement('img');
        im2.src = opts.itemImages[i];
        im2.alt = opts.issueLabels[i];
        im2.className = 'item-img self-item-img';
        selfStack.appendChild(im2);
      }

      const slider = lane.querySelector('input.lane-slider');
      const laneEntry = { lane, slider, oppStack, selfStack };
      state.lanes.push(laneEntry);

      /* 初期描画は state.lanes に積んだ後に行う(laneEntry を直接渡す) */
      paintItems(i, opts.initialValues[i] ?? 0, laneEntry);
      updateMatchClass(i, opts.initialValues[i] ?? 0, laneEntry);

      slider.addEventListener('input', (ev) => {
        const v = parseInt(ev.target.value, 10);
        paintItems(i, v);
        updateMatchClass(i, v);
        if (typeof opts.onInput === 'function') opts.onInput(i, v);
      });
      slider.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10);
        if (typeof opts.onChange === 'function') opts.onChange(i, v);
      });
    }
  }

  /* スライダー値が推薦と一致しているかで matched クラスを切替 */
  function updateMatchClass(idx, value, laneOverride) {
    if (!state) return;
    const lane = laneOverride || state.lanes[idx];
    if (!lane) return;
    const rec = state.opts.recommendation && state.opts.recommendation[idx];
    if (rec === undefined || rec === null) return;
    const matched = (Number(value) === Number(rec));
    lane.slider.classList.toggle('matched', matched);
  }

  /* アイテム可視数を更新
   * value = 美咲側(奥)の枚数(スライダー値の意味)。
   * 参加者側(手前) = max - value。
   * - paper の x_self = 美咲(エージェント)への配分 と一致
   * - スライダーを上に動かすほど value 増 → 美咲側のアイテム増 と視覚的に整合
   */
  function paintItems(idx, value, laneOverride) {
    const max = state.opts.itemMax;
    const lane = laneOverride || (state.lanes ? state.lanes[idx] : null);
    if (!lane) return;
    const myImgs = lane.selfStack.querySelectorAll('.self-item-img');
    const opImgs = lane.oppStack.querySelectorAll('.opp-item-img');
    const myVal = max - value;
    const opVal = value;
    /* display:none で本当に消す。.opp-stack/.self-stack は CSS で高さ固定なので
     * 子要素が消えてもレーン全体のレイアウトは変わらない。
     */
    myImgs.forEach((im, j) => {
      im.style.display = (j < myVal) ? '' : 'none';
    });
    opImgs.forEach((im, j) => {
      im.style.display = (j < opVal) ? '' : 'none';
    });
  }

  function setValue(idx, value) {
    if (!state) return;
    const lane = state.lanes[idx];
    if (lane) {
      lane.slider.value = String(value);
      paintItems(idx, value);
    }
  }

  function lockSlider(idx) {
    if (!state) return;
    if (state.lanes[idx]) state.lanes[idx].slider.disabled = true;
  }

  function lockAllSliders() {
    if (!state) return;
    state.lanes.forEach(l => l.slider.disabled = true);
  }

  function unlockAll() {
    if (!state) return;
    state.lanes.forEach(l => l.slider.disabled = false);
  }

  /* 次試行への切替: HTML 再構築せずに値・推薦・ロック状態だけリセット
   * これにより、テーブルが視覚的にチラつかず、画面遷移っぽく見えない。
   */
  function resetForTrial(opts) {
    if (!state) return;
    /* opts の更新(recommendation はマッチ判定で参照される) */
    if (opts.recommendation) state.opts.recommendation = opts.recommendation.slice();
    if (opts.initialValues)  state.opts.initialValues  = opts.initialValues.slice();
    if (typeof opts.maxChanges === 'number') state.opts.maxChanges = opts.maxChanges;

    /* 各レーンのスライダー値・アイテム表示・ロック・matched をリセット */
    state.lanes.forEach((lane, i) => {
      const v = (opts.initialValues && opts.initialValues[i]) ?? 0;
      lane.slider.value = String(v);
      lane.slider.disabled = false;
      paintItems(i, v);
      updateMatchClass(i, v);
    });

    /* 残り回数表示を初期値に戻す(表示モード時のみ) */
    if (typeof PARAMS !== 'undefined' && PARAMS.showRemainingCount) {
      const remainingEls = state.rootEl.querySelectorAll('.lane-remaining');
      remainingEls.forEach(el => {
        const num = el.querySelector('.remaining-num');
        if (num) num.textContent = String(opts.maxChanges ?? '-');
        el.classList.remove('exhausted');
      });
    }
  }

  function isRendered() {
    return !!(state && state.rootEl && state.rootEl.querySelector('.table-3d'));
  }

  window.TableView = {
    render, setValue, lockSlider, lockAllSliders, unlockAll,
    resetForTrial, isRendered,
  };
})();
