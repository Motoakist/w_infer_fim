/* Block 6 本試行 のロジック
 * - ラウンド開始メッセージ → 操作画面 → 表情確認画面 → 次試行
 * - 試行ごとに状態をログに記録
 *
 * 依存: params.js, expression_logic.js
 */

(function () {
  'use strict';

  /* ====== 状態 ====== */
  const sessionState = {
    participantId: null,
    conditionTheta: null,
    conditionTau:   null,
    conditionSeq:   null,
    recommendations: [],
    trials: [],
    estimatedW: [null, null, null],
    isPractice: false,
    startedAt: null,
    /* 重み (w_self, w_other) はセッション開始時にスナップショットし、
     * 全試行で同じ値を使う。試行ごとに変わってはいけない。
     */
    w_self:  null,
    w_other: null,
  };

  let trialState = null;
  let viewTimerHandle = null;

  /* ====== DOM 参照ヘルパ ====== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* レーン内の「残り N 回」表示を更新 */
  function updateRemainingInLane(root, idx, remaining) {
    const slot = root.querySelector(`.lane-remaining[data-idx="${idx}"]`);
    if (!slot) return;
    const num = slot.querySelector('.remaining-num');
    if (num) num.textContent = String(remaining);
    slot.classList.toggle('exhausted', remaining <= 0);
  }

  /* ====== セッション初期化 ====== */
  function initSession({ participantId, condTheta, condTau, condSeq, isPractice }) {
    sessionState.participantId = participantId ?? `local_${Date.now()}`;
    sessionState.conditionTheta = condTheta;
    sessionState.conditionTau   = condTau;
    sessionState.conditionSeq   = condSeq;
    sessionState.isPractice     = !!isPractice;
    sessionState.startedAt      = new Date().toISOString();
    sessionState.trials         = [];

    sessionState.recommendations = isPractice
      ? PRACTICE_RECOMMENDATIONS.map(a => a.slice())
      : getRecommendations(condTheta, condTau, condSeq);

    /* 重みをセッション開始時に一度だけスナップショット。
     * 以降の試行ではこの sessionState.w_self / w_other を使う（不変）。
     */
    sessionState.w_self  = PARAMS.w_self.slice();
    sessionState.w_other = PARAMS.w_other.slice();

    /* PARAMS.effective_* に書き込まれた条件パラメータ（initFromQualtrics 由来）を
     * sessionState にも保存。試行中はこれらを使う。
     */
    sessionState.theta_deg     = PARAMS.effective_theta_deg;
    sessionState.c_value       = PARAMS.effective_c;
    sessionState.delta_plus    = PARAMS.effective_delta_plus;
    sessionState.delta_minus   = PARAMS.effective_delta_minus;
    sessionState.tau_thresholds = PARAMS.effective_tau_thresholds
      ? PARAMS.effective_tau_thresholds.slice() : null;

    /* デバッグ用: 重みパターンと条件を console に出力 */
    const totalRounds = isPractice ? PRACTICE_RECOMMENDATIONS.length : PARAMS.T;
    console.group(`%c[Session init] ${isPractice ? '練習' : '本試行'}`, 'color:#2563eb;font-weight:bold;');
    console.log('participantId :', sessionState.participantId);
    console.log('cond_theta    :', condTheta, `(θ = ${sessionState.theta_deg}°)`);
    console.log('cond_tau      :', condTau,   `(c = ${sessionState.c_value !== null ? sessionState.c_value.toFixed(3) : 'N/A'})`);
    console.log('cond_seq      :', condSeq);
    console.log(`%c↓ w は round 1〜${totalRounds} で固定（不変）↓`, 'color:#dc2626;font-weight:bold;');
    console.log('w_self  (美咲の重み)   :', sessionState.w_self);
    console.log('w_other (あなたの重み) :', sessionState.w_other);
    console.log('Δ_+ / Δ_- :',
      sessionState.delta_plus  !== null ? sessionState.delta_plus.toFixed(3)  : 'N/A',
      '/',
      sessionState.delta_minus !== null ? sessionState.delta_minus.toFixed(3) : 'N/A');
    if (sessionState.tau_thresholds) {
      console.log('τ_b (a_b=-3..+2):', sessionState.tau_thresholds.map(t => t.toFixed(3)));
    }
    console.log('推薦系列 (美咲側の枚数 x_self):');
    console.table(sessionState.recommendations.map((r, i) => ({
      trial: i + 1,
      issue1: r[0], issue2: r[1], issue3: r[2],
    })));
    console.groupEnd();

    return sessionState;
  }

  /* ====== 試行状態のリセット ====== */
  function startTrial(trialIndex) {
    const recs = sessionState.recommendations;
    const recommendation = recs[trialIndex - 1];
    trialState = {
      trialIndex,
      recommendation,
      sliderValues: new Array(PARAMS.M).fill(0),
      sliderChangeCounts: new Array(PARAMS.M).fill(0),
      sliderHistory: [],
      hasProposed: false,
      agentExpression: 'N',
      roundStartTime: performance.now(),
      proposedAt: null,
      nextClickedAt: null,
    };
    return trialState;
  }


  /* ====== 試行画面のレンダリング ====== */
  function renderTrialScreen(root) {
    const { trialIndex, recommendation, sliderValues, sliderChangeCounts } = trialState;
    const T = PARAMS.T;
    const totalTrials = sessionState.isPractice ? PRACTICE_RECOMMENDATIONS.length : T;

    /* 表情を中立 N にリセット（前試行の表情が残らないようにする） */
    if (window.AgentCanvas) {
      window.AgentCanvas.setExpression('N');
    }

    /* ヘッダ */
    const header = $('.trial-counter', root);
    if (header) header.textContent = sessionState.isPractice
      ? `練習試行 ${trialIndex} / ${totalTrials}`
      : `試行 ${trialIndex} / ${totalTrials}`;

    /* 残り操作回数の初期表示は table_view.js の render 後に反映するので、ここでは何もしない */

    /* 推薦値の数値表示パネル
     * スライダー値 = 美咲(奥)の枚数。両側の数を併記して誤解を防ぐ。
     * 論点ラベルは廃止し、アイテム画像 + 大きな数値で表現。
     */
    const recList = $('.recommendation-list', root);
    if (recList) {
      recList.innerHTML = recommendation.map((op, i) => {
        const my = PARAMS.X_total - op;
        return `<li>
          <img src="stimuli/item${i + 1}.png" class="rec-item-img" alt="item${i + 1}">
          <span class="rec-numbers">
            <span class="rec-label">美咲</span><span class="rec-big">${op}</span>
            <span class="rec-label">あなた</span><span class="rec-big">${my}</span>
          </span>
        </li>`;
      }).join('');
    }

    /* 推薦パネル見出し / 提案ボタン / 次へボタンを試行開始時の状態に戻す */
    const recTitle = $('.rec-title', root);
    if (recTitle) recTitle.textContent = '試していただきたい配分';
    const proposeBtn = $('.propose-btn', root);
    const nextBtn = $('.next-btn', root);
    const timerNote = $('.timer-note', root);
    if (proposeBtn) {
      proposeBtn.style.display = '';
      proposeBtn.disabled = false;
    }
    if (nextBtn) {
      nextBtn.style.display = 'none';
      nextBtn.disabled = true;
    }
    if (timerNote) timerNote.textContent = '';

    /* テーブルとスライダー
     * 2 試行目以降は HTML 再構築を避けて resetForTrial で値だけ更新する。
     * これにより画面が一瞬リセットされる「ページ遷移っぽさ」を回避。
     */
    const tableBox = $('.table-container', root);
    if (tableBox && window.TableView) {
      const renderOpts = {
        issueLabels: ISSUE_LABELS,
        itemImages: ISSUE_LABELS.map((_, i) => `stimuli/item${i + 1}.png`),
        itemMax: PARAMS.X_total,
        maxChanges: PARAMS.maxChangesPerSlider,
        initialValues: sliderValues.slice(),
        recommendation: recommendation.slice(),
        onChange: (idx, value) => onSliderChange(idx, value, root),
      };
      if (window.TableView.isRendered && window.TableView.isRendered()) {
        window.TableView.resetForTrial(renderOpts);
      } else {
        window.TableView.render(tableBox, renderOpts);
      }
      /* 各レーンの残り回数を初期化(表示モード時のみ) */
      if (PARAMS.showRemainingCount) {
        sliderChangeCounts.forEach((c, i) => {
          const remaining = PARAMS.maxChangesPerSlider - c;
          updateRemainingInLane(root, i, remaining);
        });
      }
    }

    /* 提案ボタンの初期状態 */
    updateProposeButton(root);
  }

  /* ====== スライダー変更ハンドラ ======
   * 変更回数のカウント自体は常に取り続ける(ログ用)が、
   * UI 表示とスライダーのロックは PARAMS.showRemainingCount が true のときだけ行う。
   */
  function onSliderChange(idx, value, root) {
    if (!trialState || trialState.hasProposed) return;

    const prev = trialState.sliderValues[idx];
    if (prev === value) return;

    trialState.sliderChangeCounts[idx]++;
    trialState.sliderValues[idx] = value;
    trialState.sliderHistory.push({
      idx,
      from: prev,
      to: value,
      timeMs: performance.now() - trialState.roundStartTime,
    });

    /* 残り回数の UI 表示 + スライダーロックは表示モード時のみ */
    if (PARAMS.showRemainingCount) {
      const remaining = PARAMS.maxChangesPerSlider - trialState.sliderChangeCounts[idx];
      updateRemainingInLane(root, idx, remaining);
      if (remaining <= 0 && window.TableView) {
        window.TableView.lockSlider(idx);
      }
    }

    updateProposeButton(root);
  }

  /* ====== 推薦値マッチ判定（ハイライトのみに使用） ====== */
  function isAllMatched() {
    if (!trialState) return false;
    return trialState.sliderValues.every(
      (v, i) => Math.abs(v - trialState.recommendation[i]) <= PARAMS.matchTolerance
    );
  }

  /* 提案ボタンは常時活性化（推薦値と一致しなくても提案可） */
  function updateProposeButton(root) {
    const btn = $('.propose-btn', root);
    if (!btn) return;
    btn.disabled = false;
  }

  /* ====== 提案ボタン押下 ====== */
  function onPropose(root, onPostProposal) {
    if (!trialState || trialState.hasProposed) return;

    trialState.hasProposed = true;
    trialState.proposedAt = performance.now();

    /* 表情決定: 重みはセッション開始時にスナップショットされた値を使う（全試行で固定）
     * 閾値 τ_b は initFromQualtrics() で計算済みの sessionState.tau_thresholds を使用
     */
    const cValue   = sessionState.c_value;
    const thetaDeg = sessionState.theta_deg;
    const dPlus    = sessionState.delta_plus;
    const dMinus   = sessionState.delta_minus;
    const taus     = sessionState.tau_thresholds;
    const w_self   = sessionState.w_self;
    const w_other  = sessionState.w_other;
    const x_self  = trialState.sliderValues.slice();          // 美咲の配分
    const x_other = x_self.map(v => PARAMS.X_total - v);      // 参加者の配分

    let expr;
    if (taus) {
      /* 新仕様: τ閾値から累積リンクで判定 */
      expr = determineExpressionFromThresholds(
        x_self, x_other, w_self, w_other, thetaDeg, taus
      );
    } else {
      /* フォールバック: 旧 API（fixed Δ） */
      expr = determineExpression(
        x_self, w_self, w_other, thetaDeg, cValue,
        dPlus ?? 1.0, dMinus ?? 1.0, PARAMS.X_total
      );
    }
    trialState.agentExpression = expr;

    /* デバッグ: 提案内容と効用、表情判定を console に出力 */
    const u = utility(x_self, x_other, w_self, w_other, deg2rad(thetaDeg));
    const z = u - cValue;
    console.group(`%c[Trial ${trialState.trialIndex}] propose`, 'color:#16a34a;font-weight:bold;');
    console.log('w_self / w_other (固定):', w_self, '/', w_other);
    console.log('推薦         :', trialState.recommendation);
    console.log('提案 x_self  :', x_self,  '(美咲)');
    console.log('提案 x_other :', x_other, '(あなた)');
    console.log('θ° =', thetaDeg, ', c =', cValue !== null ? cValue.toFixed(3) : 'N/A');
    console.log(`u = cosθ·⟨w_self, x_self⟩ + sinθ·⟨w_other, x_other⟩ = ${u.toFixed(3)}`);
    console.log(`z = u - c = ${z.toFixed(3)}`);
    if (taus) {
      console.log('τ_b:', taus.map(t => t.toFixed(3)));
    }
    console.log('→ expression:', expr, `(${expressionLabel(expr)})`);
    console.groupEnd();

    if (typeof onPostProposal === 'function') onPostProposal(expr);
  }

  /* ====== Post-propose 状態(同一画面で表情確認) ======
   * 提案後はテーブルとスライダー位置をそのまま残し、
   *   - Live2D の表情を更新
   *   - 全スライダーをロック
   *   - 推薦パネル見出しを「美咲の反応をご確認ください」に変更
   *   - 提案ボタンを隠して次へボタンを表示(5秒タイマー)
   * を行う。画面遷移はしない。
   */
  function enterPostPropose(root, expr) {
    const counter = $('.trial-counter', root);
    if (counter) counter.textContent =
      sessionState.isPractice
        ? `練習試行 ${trialState.trialIndex} / ${PRACTICE_RECOMMENDATIONS.length}`
        : `試行 ${trialState.trialIndex} / ${PARAMS.T}`;

    /* Live2D の表情を切替 */
    if (window.AgentCanvas) {
      window.AgentCanvas.setExpression(expr);
    }

    /* 全スライダーをロック(提案確定後の操作は無効) */
    if (window.TableView && typeof window.TableView.lockAllSliders === 'function') {
      window.TableView.lockAllSliders();
    }

    /* 推薦パネル見出しを差し替え(配分の対比は表とスライダーで残ったまま) */
    const recTitle = $('.rec-title', root);
    if (recTitle) recTitle.textContent = '美咲の反応をご確認ください';

    /* 提案ボタンを隠して次へボタンを出す */
    const proposeBtn = $('.propose-btn', root);
    if (proposeBtn) proposeBtn.style.display = 'none';

    const nextBtn = $('.next-btn', root);
    const timerNote = $('.timer-note', root);
    if (nextBtn) {
      nextBtn.style.display = '';
      nextBtn.disabled = true;
      let secs = Math.ceil(PARAMS.minViewDurationMs / 1000);
      if (timerNote) timerNote.textContent = `表情を確認してください(${secs}秒後に次へ進めます)`;
      clearInterval(viewTimerHandle);
      viewTimerHandle = setInterval(() => {
        secs--;
        if (secs <= 0) {
          clearInterval(viewTimerHandle);
          viewTimerHandle = null;
          nextBtn.disabled = false;
          if (timerNote) timerNote.textContent = '次へ進めます';
        } else {
          if (timerNote) timerNote.textContent = `表情を確認してください(${secs}秒後に次へ進めます)`;
        }
      }, 1000);
    }
  }

  /* 旧 API 互換: renderViewScreen は enterPostPropose に転送 */
  function renderViewScreen(root, expr) {
    enterPostPropose(root, expr);
  }

  /* ====== 試行終了 ====== */
  function endTrial() {
    if (!trialState) return;
    trialState.nextClickedAt = performance.now();
    sessionState.trials.push({
      trial_index: trialState.trialIndex,
      recommendation: trialState.recommendation.slice(),
      slider_history: trialState.sliderHistory.slice(),
      slider_change_count: trialState.sliderChangeCounts.slice(),
      final_proposal: trialState.sliderValues.slice(),
      agent_expression: trialState.agentExpression,
      propose_time_ms: trialState.proposedAt - trialState.roundStartTime,
      next_click_time_ms: trialState.nextClickedAt - (trialState.proposedAt ?? trialState.roundStartTime),
    });
  }

  /* ====== ラウンド開始メッセージ ====== */
  function renderRoundIntro(root) {
    const { trialIndex, recommendation } = trialState;
    const counter = $('.trial-counter', root);
    if (counter) counter.textContent =
      sessionState.isPractice
        ? `練習試行 ${trialIndex} / ${PRACTICE_RECOMMENDATIONS.length}`
        : `試行 ${trialIndex} / ${PARAMS.T}`;

    const list = $('.intro-recommendation-list', root);
    if (list) {
      list.innerHTML = ISSUE_LABELS.map(
        (lab, i) => `<li>${lab}: <strong>${recommendation[i]}</strong> / ${PARAMS.X_total}</li>`
      ).join('');
    }
  }

  /* ====== 公開API ====== */
  window.MainTrial = {
    initSession,
    startTrial,
    renderRoundIntro,
    renderTrialScreen,
    onPropose,
    enterPostPropose,
    renderViewScreen,        // 後方互換のため残す(中身は enterPostPropose に転送)
    endTrial,
    sessionState,
    getTrialState: () => trialState,
  };
})();
