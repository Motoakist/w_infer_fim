/* Live2D Agent (美咲) の表示と表情制御
 *
 * former_exp.js から CDN ライブラリを継承して使用。
 * IndexLibrary は内部で agent_point/limit/op_max から表情を計算するので、
 * 本研究の表情決定ロジック (expression_logic.js) で算出した値を
 * agent_point として渡し、内部の表情マッピングをトリガする。
 *
 * Live2D のロードに失敗した場合は PNG フォールバック（stimuli/{expr}.png）。
 */

(function () {
  'use strict';

  const RESOURCES = [
    'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
    'https://cdn.jsdelivr.net/gh/Motoakist/geminoidF@1dde6a0d3338d14148f61b376227501880b8a5cd/js/indexLibraryRealtime.js',
  ];
  const MODEL_PATH = 'https://cdn.jsdelivr.net/gh/Motoakist/geminoidF@caf3917782d785add25041d470a6db22380a039e/GeminoidF_key_reduced/moc/GeminoidF_new/GeminoidF_new.model3.json';
  const SERVER_URL = '';

  const POSITION = {
    boxWidth:  1000,
    boxHeight: 1000,
    modelScale: 0.15,
    modelX: 0,
    modelY: 500,
  };

  /* 7段階表情 → Live2D の表情名への直接マッピング。
   * IndexLibrary 内部の change_face() は agent_point→happy 表情への補間しかできず、
   * Anger 範囲では anger11-10 一択、ニュートラルが happy11-7 に飛ぶなど精度が悪い。
   * そのため app.pixiCanvas.hiyori.setExpression(name) を直接呼ぶ。
   *
   * 値は配列で順に適用（Live2D は前段の表情ブレンドが残ることがあるので、
   * 「リセット用の表情」を先に当ててから本命を当てるのが安全）。
   *
   * モデル内の利用可能表情：
   *   joy:   happy11-1, happy11-2, happy11-4, happy11-5, happy11-7, happy11-8, happy11-9, happy11-11
   *   anger: anger11-10, anger11-9, anger11-7, anger11-6, anger11-4, anger11-3, anger11-1
   *
   * Neutral (N) は anger11-1 → happy11-1 を 3 回繰り返して
   * 表情ブレンドの残響を確実に消す。
   */
  const EXPR_TO_LIVE2D = {
    A3: ['anger11-10'],
    A2: ['anger11-7'],
    A1: ['anger11-3'],
    N:  ['anger11-1', 'happy11-1',
         'anger11-1', 'happy11-1',
         'anger11-1', 'happy11-1'],
    J1: ['happy11-5'],
    J2: ['happy11-8'],
    J3: ['happy11-11'],
  };

  let indexLibrary = null;
  let live2dReady = false;
  let useLive2D = true;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error('failed: ' + url));
      document.head.appendChild(s);
    });
  }

  async function loadAll() {
    if (typeof window.IndexLibrary !== 'undefined') return;
    for (const url of RESOURCES) {
      try { await loadScript(url); }
      catch (e) {
        console.warn('Live2D resource load failed:', url);
        useLive2D = false;
        return;
      }
    }
  }

  /* Live2D の初期化
   * - canvasId: 描画先 <canvas> の id
   */
  async function init(canvasId) {
    await loadAll();
    if (!useLive2D) return false;
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('Agent canvas not found:', canvasId);
      return false;
    }
    canvas.id = 'myCanvas';
    try {
      indexLibrary = new window.IndexLibrary(false, SERVER_URL, MODEL_PATH, POSITION);
      indexLibrary.onload();
      live2dReady = true;
      /* 初期表情はニュートラル: anger11-1 → happy11-1 の順に当ててリセット */
      _trySetLive2DSequence(['anger11-1', 'happy11-1']);
      return true;
    } catch (e) {
      console.warn('Live2D init failed, falling back to PNG:', e);
      useLive2D = false;
      live2dReady = false;
      return false;
    }
  }

  /* モデル参照を取得（読み込み待ち中は null を返す） */
  function _getModel() {
    return (indexLibrary && indexLibrary.app && indexLibrary.app.pixiCanvas)
      ? indexLibrary.app.pixiCanvas.hiyori
      : null;
  }

  /* モデルが読み込まれているか不確定なので、軽くリトライ付きで設定する */
  function _trySetLive2D(name, retries) {
    if (retries === undefined) retries = 12; // 12 * 250ms = 3s 程度
    if (!indexLibrary) return;
    try {
      const model = _getModel();
      if (model && typeof model.setExpression === 'function') {
        model.setExpression(name);
        return;
      }
      throw new Error('model not ready');
    } catch (e) {
      if (retries > 0) {
        setTimeout(() => _trySetLive2D(name, retries - 1), 250);
      } else {
        console.warn('Live2D setExpression retry exhausted:', name, e && e.message);
      }
    }
  }

  /* 表情を順に当てる（前段リセット用 → 本命）。
   * Live2D の表情ブレンドは即座には反映されないので、
   * 各表情の適用間に少し遅延を挟む。
   */
  const STEP_INTERVAL_MS = 80; // 各 setExpression 間の間隔

  function _trySetLive2DSequence(names, retries) {
    if (retries === undefined) retries = 12;
    if (!indexLibrary) return;
    const model = _getModel();
    if (!model || typeof model.setExpression !== 'function') {
      if (retries > 0) {
        setTimeout(() => _trySetLive2DSequence(names, retries - 1), 250);
      } else {
        console.warn('Live2D sequence retry exhausted:', names);
      }
      return;
    }
    /* 1 つ目は即時、以降は STEP_INTERVAL_MS ごとにずらして適用 */
    names.forEach((name, i) => {
      const apply = () => {
        try { model.setExpression(name); }
        catch (e) { console.warn('Live2D setExpression error:', name, e && e.message); }
      };
      if (i === 0) apply();
      else setTimeout(apply, i * STEP_INTERVAL_MS);
    });
  }

  /* 表情を設定する
   * - expression: 'A3' .. 'J3'
   * 互換性のため第 2, 第 3 引数（imgEl, labelEl）を受け取れるが、無視する。
   */
  function setExpression(expression /*, imgEl, labelEl */) {
    if (!live2dReady || !indexLibrary) return;
    const seq = EXPR_TO_LIVE2D[expression];
    if (Array.isArray(seq) && seq.length > 0) {
      _trySetLive2DSequence(seq);
    }
  }

  function isLive2DActive() {
    return live2dReady;
  }

  window.AgentCanvas = { init, setExpression, isLive2DActive };
})();
