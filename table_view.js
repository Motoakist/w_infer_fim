/* 3D テーブル + アイテム配置 + 垂直スライダー
 *
 * 設計上のポイント：
 * - 台形は SVG で「奥が狭く、手前が広い」遠近表現として描画。
 * - 3 つのレーン（論点）は等間隔に水平配置し、各レーンには垂直スライダーを置く。
 * - スライダーは回転を使わず writing-mode: vertical-lr で素直に垂直化。
 * - アイテムは絶対配置で重ね描き、最大値ぶん事前生成して可視/不可視で表現
 *   → 値変化でレイアウトが変わらず、スライダーの位置がブレない。
 *
 * API:
 *   TableView.render(rootEl, {
 *     issueLabels, itemImages, itemMax, initialValues,
 *     onChange: (idx, value) => {}, onInput: (idx, value) => {}
 *   })
 *   TableView.setValue(idx, value)
 *   TableView.lockSlider(idx)
 */

(function () {
  'use strict';

  /* ===== ジオメトリ =====
   * 台形は奥（上辺=狭い）と手前（下辺=広い）の遠近感を作る。
   * 各レーンは台形の対角線に沿って傾ける（中央レーンのみ垂直）。
   */
  const TABLE_WIDTH  = 720;
  const TABLE_HEIGHT = 360;
  const TABLE_TAPER  = 160;  // 上辺の左右切り欠き量

  /* レーンの上下端 X 座標（台形の対角線と平行） */
  function laneXTop(idx, total) {
    const usable = TABLE_WIDTH - 2 * TABLE_TAPER;
    return TABLE_TAPER + usable * (idx + 1) / (total + 1);
  }
  function laneXBottom(idx, total) {
    return TABLE_WIDTH * (idx + 1) / (total + 1);
  }

  let state = null; // { rootEl, opts, lanes:[] }

  function render(rootEl, opts) {
    const num = opts.issueLabels.length;
    const max = opts.itemMax;
    const recommendation = opts.recommendation || [];

    /* SVG 台形の頂点 */
    const x1 = TABLE_TAPER;                  // 上辺左
    const x2 = TABLE_WIDTH - TABLE_TAPER;    // 上辺右
    const x3 = TABLE_WIDTH;                  // 下辺右
    const x4 = 0;                            // 下辺左

    rootEl.innerHTML = `
      <div class="table-3d">
        <div class="table-side-label opponent">↑ 美咲（奥）</div>
        <svg class="table-3d-svg" viewBox="0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}" preserveAspectRatio="none">
          <polygon points="${x1},0 ${x2},0 ${x3},${TABLE_HEIGHT} ${x4},${TABLE_HEIGHT}" />
        </svg>
        <div class="lanes"></div>
        <div class="table-side-label self">↓ あなた（手前）</div>
      </div>
    `;

    const lanesEl = rootEl.querySelector('.lanes');
    state = { rootEl, opts, lanes: [] };

    for (let i = 0; i < num; i++) {
      const xTop    = laneXTop(i, num);
      const xBottom = laneXBottom(i, num);
      /* レーンの中心 X は上下平均（垂直配置の中央） */
      const cx = (xTop + xBottom) / 2;
      const leftPct = (cx / TABLE_WIDTH) * 100;

      /* 対角線に沿った傾き角度（度数法）
       *   xTop > xBottom（左レーン）: 正の値 → 時計回り（top が右に倒れる）
       *   xTop < xBottom（右レーン）: 負の値 → 反時計回り
       *   中央レーン: 0
       */
      const angleDeg = Math.atan2(xTop - xBottom, TABLE_HEIGHT) * 180 / Math.PI;

      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.idx = String(i);
      lane.style.left = `calc(${leftPct}% - 50px)`;
      lane.style.setProperty('--lane-angle', `${angleDeg}deg`);
      lane.style.setProperty('--lane-counter-angle', `${-angleDeg}deg`);
      lane.innerHTML = `
        <div class="opp-stack" data-idx="${i}"></div>
        <input type="range" class="lane-slider" min="0" max="${max}" step="1"
               value="${opts.initialValues[i] ?? 0}" data-idx="${i}" />
        <div class="lane-remaining" data-idx="${i}">残り <span class="remaining-num">${opts.maxChanges ?? '-'}</span> 回</div>
        <div class="lane-label">${opts.issueLabels[i]}</div>
        <div class="self-stack" data-idx="${i}"></div>
      `;
      lanesEl.appendChild(lane);

      /* アイテムを最大数ぶん事前配置（可視/不可視で枚数を表現） */
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

      /* 初期描画は state.lanes に積んだ後に行う（laneEntry を直接渡す） */
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
   * value = 美咲側（奥）の枚数（スライダー値の意味）。
   * 参加者側（手前） = max - value。
   * - paper の x_self = 美咲（エージェント）への配分 と一致
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

  function unlockAll() {
    if (!state) return;
    state.lanes.forEach(l => l.slider.disabled = false);
  }

  window.TableView = { render, setValue, lockSlider, unlockAll };
})();
