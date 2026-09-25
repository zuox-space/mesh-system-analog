// content-script.js — панель «Помощник в МЭШ» + onboarding-тур
(function () {
    "use strict";

    if (document.getElementById("mesh-helper-root")) return;

    const ROOT_ID = "mesh-helper-root";
    const STATE_KEY = "meshHelperPanelOpen";
    const TOUR_KEY = "meshHelperTourShown";

    const C_BG = "#2b3858";
    const C_BG_CARD = "#354566";
    const C_BG_DEEP = "#1f2a45";
    const C_BORDER = "rgba(255, 255, 255, 0.08)";

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
    document.documentElement.appendChild(root);

    const shadow = root.attachShadow({ mode: "open" });

    // ============================================================
    // Стили
    // ============================================================
    const style = document.createElement("style");
    style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; }

    .panel {
      position: fixed;
      top: 12px; right: 12px; bottom: 12px;
      width: min(1180px, calc(100vw - 24px));
      background: ${C_BG};
      color: #E6EDF7;
      border: 1px solid ${C_BORDER};
      border-radius: 20px;
      box-shadow: -16px 16px 48px rgba(0, 0, 0, 0.55);
      display: flex; flex-direction: column;
      pointer-events: auto;
      transform: translateX(0); opacity: 1;
      transition: transform 0.3s ease, opacity 0.3s ease;
      font-size: 14px; overflow: hidden;
    }
    .panel.collapsed { transform: translateX(calc(100% + 24px)); opacity: 0; pointer-events: none; }

    .rail {
      position: fixed; top: 90px; right: 0;
      pointer-events: auto;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 14px 12px;
      background: linear-gradient(135deg, #4A9EFF, #7B61FF);
      border-radius: 14px 0 0 14px;
      cursor: pointer;
      box-shadow: -6px 6px 22px rgba(74, 158, 255, 0.4);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      user-select: none; max-width: 72px;
    }
    .rail:hover { transform: translateX(-6px); }
    .rail.warn { background: linear-gradient(135deg, #F59E0B, #F97316); }
    .rail.err  { background: linear-gradient(135deg, #EF4444, #DC2626); }
    .rail img { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
    .rail .rail-badge {
      background: rgba(255, 255, 255, 0.28);
      color: #fff; border-radius: 8px;
      font-size: 13px; font-weight: 800;
      padding: 4px 10px;
    }
    .rail .rail-badge.err { background: #fff; color: #EF4444; }
    .rail .rail-badge.warn { background: #fff; color: #F59E0B; }
    .rail .rail-label {
      writing-mode: vertical-rl; text-orientation: mixed;
      font-size: 14px; font-weight: 800; letter-spacing: 1px;
      color: #fff; padding: 8px 0;
    }

    .panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 22px;
      border-bottom: 1px solid ${C_BORDER};
      flex-shrink: 0;
    }
    .panel-logo { display: flex; align-items: center; gap: 14px; }
    .panel-logo img { width: 40px; height: 40px; border-radius: 10px; }
    .panel-title { font-size: 17px; font-weight: 800; line-height: 1.1; }
    .panel-sub { font-size: 11px; color: #A8B5CC; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
    .panel-head-actions { display: flex; gap: 8px; align-items: center; }
    .icon-btn {
      background: rgba(255, 255, 255, 0.08);
      color: #A8C5E8;
      border: 1px solid ${C_BORDER};
      border-radius: 10px;
      width: 40px; height: 40px;
      font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .icon-btn:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
    .icon-btn.help {
      font-size: 20px; font-weight: 800;
      background: rgba(74, 158, 255, 0.15);
      border-color: rgba(74, 158, 255, 0.4);
      color: #4A9EFF;
    }
    .icon-btn.help:hover {
      background: rgba(74, 158, 255, 0.3);
      color: #fff;
      box-shadow: 0 4px 14px rgba(74, 158, 255, 0.4);
    }

    .panel-body {
      flex: 1; overflow-y: auto;
      padding: 16px 20px 20px;
      display: grid;
      grid-template-columns: 1.1fr 1.4fr 1.2fr;
      gap: 16px; align-content: start;
    }
    .panel-body::-webkit-scrollbar { width: 8px; }
    .panel-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }

    .col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

    .section { display: flex; flex-direction: column; gap: 10px; }
    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .section-title {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 1.5px; color: #A8B5CC; font-weight: 800;
    }
    .section-count { font-size: 12px; color: #94A3B8; font-weight: 600; }
    .section-count b { color: #E6EDF7; }

    .crit-header {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 14px;
      padding: 14px 16px;
    }
    .crit-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .crit-title { font-size: 14px; font-weight: 700; }
    .crit-badge {
      font-size: 11px; font-weight: 800;
      padding: 4px 12px; border-radius: 6px;
      background: rgba(255, 255, 255, 0.1); color: #A8B5CC;
      text-transform: uppercase;
    }
    .crit-badge.ok { background: rgba(52,211,153,0.2); color: #34D399; }
    .crit-badge.err { background: rgba(248,113,113,0.2); color: #F87171; }
    .crit-badge.warn { background: rgba(251,191,36,0.2); color: #FBBF24; }
    .crit-period { font-size: 12px; color: #A8B5CC; margin-bottom: 4px; }
    .crit-summary { font-size: 11px; color: #94A3B8; }

    .crit-bars {
      display: flex; flex-direction: column; gap: 12px;
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 14px;
      padding: 14px 16px;
    }
    .crit-bar { display: flex; flex-direction: column; gap: 5px; }
    .crit-bar-head {
      display: flex; justify-content: space-between; align-items: baseline;
      font-size: 12px; color: #A8B5CC;
      text-transform: uppercase; font-weight: 700;
    }
    .crit-bar-head b { color: #E6EDF7; font-size: 16px; font-weight: 800; }
    .bar { height: 8px; border-radius: 4px; overflow: hidden; background: rgba(255, 255, 255, 0.08); }
    .bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #4A9EFF, #7B61FF);
      transition: width 0.4s ease;
    }
    .bar-fill.ok { background: linear-gradient(90deg, #34D399, #10B981); }
    .bar-fill.warn { background: linear-gradient(90deg, #FBBF24, #F59E0B); }
    .bar-fill.err { background: linear-gradient(90deg, #F87171, #DC2626); }

    .lesson-status {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 14px;
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .lesson-status.ok { border-color: rgba(52,211,153,0.5); }
    .lesson-status.warn { border-color: rgba(251,191,36,0.5); }
    .lesson-status.err { border-color: rgba(248,113,113,0.5); }
    .lesson-status-title {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 1.2px; font-weight: 800; color: #A8B5CC;
    }
    .lesson-status-text {
      font-size: 14px; font-weight: 700;
      color: #E6EDF7; line-height: 1.35;
    }
    .lesson-status-sub {
      font-size: 12px; color: #A8B5CC; line-height: 1.4;
    }
    .lesson-status-tag {
      display: inline-block;
      font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-right: 6px;
    }
    .lesson-status-tag.ok { background: rgba(52,211,153,0.2); color: #34D399; }
    .lesson-status-tag.warn { background: rgba(251,191,36,0.2); color: #FBBF24; }
    .lesson-status-tag.err { background: rgba(248,113,113,0.2); color: #F87171; }

    .ktp-meta {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 12px; color: #A8B5CC;
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px;
    }
    .ktp-meta b { color: #E6EDF7; }

    .actions { display: flex; flex-direction: column; gap: 8px; }
    .btn {
      width: 100%;
      padding: 11px 16px;
      border: none; border-radius: 12px;
      font-size: 13px; font-weight: 700;
      cursor: pointer; transition: all 0.2s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: linear-gradient(135deg, #4A9EFF, #7B61FF); color: #fff; }
    .btn-primary:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(74, 158, 255, 0.45); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #C7D2E5;
      border: 1px solid ${C_BORDER};
    }
    .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); color: #fff; }
    .btn-small {
      padding: 6px 12px;
      font-size: 12px; font-weight: 700;
      border-radius: 8px; border: none;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-play {
      background: linear-gradient(135deg, #4A9EFF, #7B61FF);
      color: #fff;
      padding: 6px 12px;
      font-size: 12px; font-weight: 700;
      border-radius: 8px; border: none;
      cursor: pointer; flex-shrink: 0;
    }
    .btn-play:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(74, 158, 255, 0.5); }
    .btn-play:disabled { opacity: 0.4; cursor: not-allowed; }

    .list { display: flex; flex-direction: column; gap: 8px; }
    .item {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
    }
    .item.warn { border-color: rgba(251,191,36,0.45); }
    .item.ok   { border-color: rgba(52,211,153,0.5); }
    .item.err  { border-color: rgba(248,113,113,0.5); }
    .item-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .item-main { min-width: 0; flex: 1; }
    .item-class {
      font-weight: 800; font-size: 13px; color: #E6EDF7;
      margin-bottom: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .item-topic {
      font-size: 11px; color: #A8B5CC;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .item-time {
      font-family: ui-monospace, monospace;
      color: #C7D2E5; font-size: 13px; font-weight: 700;
    }
    .item-status {
      font-size: 10px; color: #94A3B8;
      text-align: right; margin-top: 2px;
    }
    .item-status.ok { color: #34D399; }
    .item-status.err { color: #F87171; }
    .item-status.warn { color: #FBBF24; }
    .item-timebox { text-align: right; flex-shrink: 0; }
    .item-actions { flex-shrink: 0; display: flex; align-items: center; }

    .hw-period {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 12px;
      padding: 10px 12px;
    }
    .hw-period-title {
      font-size: 12px; font-weight: 700; color: #E6EDF7;
      margin-bottom: 8px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .hw-period-title .tag {
      font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 4px;
      background: rgba(74, 158, 255, 0.2);
      color: #4A9EFF;
      border: 1px solid rgba(74, 158, 255, 0.4);
    }
    .hw-period-stats {
      font-size: 11px; color: #A8B5CC; margin-bottom: 8px;
      display: flex; gap: 12px;
    }
    .hw-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
    }
    .hw-day {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 5px 2px; border-radius: 6px;
      background: ${C_BG_DEEP}; min-height: 48px;
    }
    .hw-day.today {
      background: rgba(74, 158, 255, 0.15);
      border: 1px solid rgba(74, 158, 255, 0.4);
    }
    .hw-day.past { opacity: 0.6; }
    .hw-day-date {
      font-size: 9px; font-family: ui-monospace, monospace;
      color: #94A3B8; font-weight: 700;
    }
    .hw-day.today .hw-day-date { color: #4A9EFF; }
    .hw-squares { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
    .hw-sq {
      width: 14px; height: 14px; border-radius: 3px;
      border: 1px solid transparent; cursor: pointer;
      transition: all 0.15s;
    }
    .hw-sq:hover { transform: scale(1.2); }
    .hw-sq.has { border-color: rgba(52,211,153,0.7); background: rgba(52,211,153,0.4); }
    .hw-sq.missing-past { border-color: rgba(248,113,113,0.7); background: rgba(248,113,113,0.4); }
    .hw-sq.missing-future { border-color: rgba(251,191,36,0.7); background: rgba(251,191,36,0.45); }
    .hw-sq.window {
      border: 1px dashed rgba(122,140,168,0.5);
      background: transparent; cursor: default;
    }
    .hw-sq.window:hover { transform: none; }

    .ktp-ok-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .ktp-ok-item {
      background: rgba(52, 211, 153, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-radius: 8px; padding: 5px 10px;
      font-size: 11px; font-weight: 600;
      color: #A7F3D0; cursor: default;
      max-width: 100%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ktp-ok-item::before {
      content: "✓ "; color: #34D399; font-weight: 800;
    }

    .ktp-problem-list { display: flex; flex-direction: column; gap: 8px; }
    .ktp-problem {
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.35);
      border-radius: 10px; padding: 10px 12px;
    }
    .ktp-problem.no-plan {
      background: rgba(248, 113, 113, 0.08);
      border-color: rgba(248, 113, 113, 0.4);
    }
    .ktp-problem-head {
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; margin-bottom: 6px;
    }
    .ktp-problem-name {
      font-size: 12px; font-weight: 700; color: #FBBF24;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      min-width: 0; flex: 1;
    }
    .ktp-problem.no-plan .ktp-problem-name { color: #F87171; }
    .ktp-problem-tag {
      font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 4px;
      background: rgba(248, 113, 113, 0.2);
      color: #F87171;
      border: 1px solid rgba(248, 113, 113, 0.4);
      white-space: nowrap; flex-shrink: 0;
    }
    .ktp-problem-stats {
      display: flex; gap: 10px; font-size: 10px;
      color: #A8B5CC; margin-bottom: 6px; flex-wrap: wrap;
    }
    .ktp-problem-stats b { color: #FBBF24; font-weight: 800; }
    .ktp-problem-stats .ok b { color: #34D399; }
    .ktp-problem-hint {
      font-size: 11px; color: #94A3B8;
      padding: 4px 0; line-height: 1.35;
    }

    .settings-card {
      background: ${C_BG_CARD};
      border: 1px solid ${C_BORDER};
      border-radius: 14px;
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 14px;
      margin-top: 6px;
    }
    .settings-title {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 1.5px; color: #A8B5CC; font-weight: 800;
    }
    .setting-row {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; cursor: pointer;
    }
    .setting-label { min-width: 0; flex: 1; }
    .setting-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
    .setting-desc { font-size: 11px; color: #A8B5CC; line-height: 1.35; }
    .setting-desc b { color: #E6EDF7; }

    .switch {
      appearance: none;
      width: 44px; height: 24px; border-radius: 12px;
      background: rgba(255, 255, 255, 0.15);
      position: relative; cursor: pointer;
      transition: background 0.25s; flex-shrink: 0;
      margin-top: 2px;
    }
    .switch::before {
      content: "";
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; transition: transform 0.25s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .switch:checked { background: linear-gradient(135deg, #4A9EFF, #7B61FF); }
    .switch:checked::before { transform: translateX(20px); }

    .setting-field { display: flex; flex-direction: column; gap: 6px; }
    .setting-field-label { font-size: 12px; font-weight: 600; color: #E6EDF7; }
    .setting-input {
      width: 100%; padding: 9px 12px;
      background: rgba(11, 18, 32, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px; color: #E6EDF7;
      font-size: 13px; font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .setting-input:focus {
      border-color: rgba(74, 158, 255, 0.6);
      box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.15);
    }
    .setting-hint { font-size: 10px; color: #94A3B8; line-height: 1.35; }

    .tour-restart-btn {
      background: rgba(74, 158, 255, 0.12);
      border: 1px solid rgba(74, 158, 255, 0.35);
      color: #4A9EFF;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s;
      margin-top: 4px;
    }
    .tour-restart-btn:hover {
      background: rgba(74, 158, 255, 0.25);
      color: #fff;
    }

    .empty {
      text-align: center; padding: 16px;
      font-size: 12px; color: #94A3B8;
      background: ${C_BG_DEEP};
      border: 1px dashed ${C_BORDER};
      border-radius: 12px;
    }

    .panel-toast {
      position: fixed; bottom: 24px; right: 24px;
      max-width: 420px;
      background: ${C_BG_CARD};
      border: 1px solid rgba(74, 158, 255, 0.5);
      border-radius: 10px;
      padding: 12px 18px;
      font-size: 14px; color: #E6EDF7;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      pointer-events: none;
      opacity: 0; transform: translateY(8px);
      transition: opacity 0.3s, transform 0.3s;
      z-index: 2;
    }
    .panel-toast.show { opacity: 1; transform: translateY(0); }
    .panel-toast.ok { border-color: rgba(52,211,153,0.7); color: #34D399; }
    .panel-toast.err { border-color: rgba(248,113,113,0.7); color: #F87171; }

    /* ==========================================================
       ONBOARDING-ТУР
       ========================================================== */
    .tour-overlay {
      position: fixed; inset: 0;
      z-index: 2147483646;
      pointer-events: auto;
      display: none;
    }
    .tour-overlay.show { display: block; }

    /* Маска без размытия, лёгкое затемнение */
    .tour-mask {
      position: absolute; inset: 0;
      background: rgba(0, 0, 0, 0.35);
    }

    /* Светлое окно подсветки */
    .tour-spotlight {
      position: absolute;
      border-radius: 14px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
      border: 2px solid #4A9EFF;
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1;
      background: transparent;
    }

    .tour-tip {
      position: absolute; z-index: 2;
      background: #354566;
      border: 1px solid rgba(74, 158, 255, 0.5);
      border-radius: 14px;
      padding: 18px 20px 16px;
      max-width: 360px;
      color: #E6EDF7;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tour-tip-title { font-size: 15px; font-weight: 800; margin-bottom: 8px; color: #E6EDF7; }
    .tour-tip-text { font-size: 13px; color: #C7D2E5; line-height: 1.5; margin-bottom: 14px; }
    .tour-tip-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .tour-progress { font-size: 11px; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; }
    .tour-progress b { color: #E6EDF7; }
    .tour-btns { display: flex; gap: 8px; }
    .tour-btn {
      padding: 8px 16px;
      border: none; border-radius: 10px;
      font-size: 13px; font-weight: 700;
      cursor: pointer; transition: all 0.2s;
    }
    .tour-btn-primary { background: linear-gradient(135deg, #4A9EFF, #7B61FF); color: #fff; }
    .tour-btn-primary:hover { box-shadow: 0 4px 16px rgba(74, 158, 255, 0.5); }
    .tour-btn-skip { background: transparent; color: #94A3B8; padding: 8px 10px; }
    .tour-btn-skip:hover { color: #E6EDF7; }

    .tour-cursor {
      position: absolute; z-index: 3;
      width: 28px; height: 28px;
      pointer-events: none;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
    }
    .tour-cursor svg { width: 100%; height: 100%; display: block; }
    .tour-cursor.click { animation: tour-click 0.5s ease; }
    @keyframes tour-click {
      0% { transform: scale(1); }
      40% { transform: scale(0.75); }
      100% { transform: scale(1); }
    }
    .tour-cursor-ripple {
      position: absolute; top: 0; left: 0;
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(74, 158, 255, 0.5);
      transform: scale(0); pointer-events: none; z-index: -1;
    }
    .tour-cursor.click .tour-cursor-ripple { animation: tour-ripple 0.6s ease; }
    @keyframes tour-ripple {
      0% { transform: scale(0); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
  `;
    shadow.appendChild(style);

    // ============================================================
    // Разметка панели
    // ============================================================
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
    <div class="panel-head">
      <div class="panel-logo">
        <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="" />
        <div>
          <div class="panel-title">Помощник в МЭШ</div>
          <div class="panel-sub">панель управления</div>
        </div>
      </div>
      <div class="panel-head-actions">
        <button class="icon-btn help" id="tourBtn" title="Показать обучение">?</button>
        <button class="icon-btn" id="closeBtn" title="Свернуть">→</button>
      </div>
    </div>

    <div class="panel-body">

      <div class="col">
        <div class="crit-header" id="tour-crit-header">
          <div class="crit-top">
            <span class="crit-title">Критерии надбавки</span>
            <span class="crit-badge" id="critBadge">—</span>
          </div>
          <div class="crit-period" id="critPeriod">Загрузка…</div>
          <div class="crit-summary" id="critSummary"></div>
        </div>

        <div class="crit-bars">
          <div class="crit-bar">
            <div class="crit-bar-head"><span>ДЗ</span><b id="hwVal">0%</b></div>
            <div class="bar"><div class="bar-fill" id="hwBar"></div></div>
          </div>
          <div class="crit-bar">
            <div class="crit-bar-head"><span>КТП</span><b id="ktpVal">0%</b></div>
            <div class="bar"><div class="bar-fill" id="ktpBar"></div></div>
          </div>
          <div class="crit-bar">
            <div class="crit-bar-head"><span>Запуск</span><b id="launchVal">0%</b></div>
            <div class="bar"><div class="bar-fill" id="launchBar"></div></div>
          </div>
        </div>

        <div class="actions" id="tour-actions">
          <button class="btn btn-primary" id="refreshAllBtn" data-tour="refresh">Обновить данные</button>
          <button class="btn btn-secondary" id="bulkEmptyBtn" data-tour="bulk">Заполнить все без ДЗ</button>
          <button class="btn btn-secondary" id="updateKtpBtn" data-tour="ktp-update">Обновить все КТП</button>
          <button class="btn btn-secondary" id="openFullBtn" data-tour="open-full">Открыть полную панель</button>
        </div>

        <div class="settings-card" id="tour-settings" data-tour="settings">
          <div class="settings-title">Настройки</div>
          <label class="setting-row">
            <div class="setting-label">
              <div class="setting-name">Автозапуск уроков</div>
              <div class="setting-desc">Уроки открываются автоматически в момент старта.</div>
            </div>
            <input type="checkbox" id="setAutoLaunch" class="switch">
          </label>
          <label class="setting-row">
            <div class="setting-label">
              <div class="setting-name">Автообновление КТП</div>
              <div class="setting-desc">Раз в сутки. Последнее: <b id="setLastKtp">—</b></div>
            </div>
            <input type="checkbox" id="setAutoKtp" class="switch">
          </label>
          <div class="setting-field">
            <label class="setting-field-label" for="setCatchUp">Догон пропущенных уроков</label>
            <input type="number" id="setCatchUp" class="setting-input" min="0" max="180" step="5" placeholder="60">
            <div class="setting-hint">В минутах. Если урок начался недавно — он будет запущен в этом окне.</div>
          </div>
          <button class="tour-restart-btn" id="restartTourBtn">Показать обучение снова</button>
        </div>
      </div>

      <div class="col">
        <div class="lesson-status" id="lessonStatusBox" data-tour="lesson-status">
          <div class="lesson-status-title">Статус урока</div>
          <div class="lesson-status-text" id="lessonStatusText">Загрузка…</div>
          <div class="lesson-status-sub" id="lessonStatusSub"></div>
        </div>

        <div class="section" data-tour="lessons">
          <div class="section-head">
            <span class="section-title">Ближайшие уроки</span>
            <span class="section-count" id="lessonsCount"></span>
          </div>
          <div class="list" id="lessonsList"></div>
        </div>

        <div class="section" data-tour="homework">
          <div class="section-head">
            <span class="section-title">Домашние задания · отчётный период</span>
            <span class="section-count" id="hwCount"></span>
          </div>
          <div id="hwPeriods"></div>
        </div>
      </div>

      <div class="col">
        <div class="section" data-tour="ktp">
          <div class="section-head">
            <span class="section-title">КТП по группам</span>
            <span class="section-count" id="ktpCount"></span>
          </div>
          <div class="ktp-meta">
            <span>последнее обновление:</span>
            <b id="ktpLastUpdate">—</b>
          </div>
          <div id="ktpOkList" class="ktp-ok-list"></div>
          <div id="ktpProblemList" class="ktp-problem-list"></div>
        </div>
      </div>

    </div>

    <div class="panel-toast" id="panelToast"></div>
  `;

    const rail = document.createElement("div");
    rail.className = "rail";
    rail.title = "Открыть Помощник в МЭШ";
    rail.innerHTML = `
    <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="" />
    <span class="rail-badge" id="railBadge">…</span>
    <span class="rail-label">Помощник в МЭШ</span>
  `;

    shadow.appendChild(panel);
    shadow.appendChild(rail);

    // ============================================================
    // Управление панелью
    // ============================================================
    const closeBtn = shadow.getElementById("closeBtn");
    const tourBtn = shadow.getElementById("tourBtn");
    const restartTourBtn = shadow.getElementById("restartTourBtn");
    const refreshAllBtn = shadow.getElementById("refreshAllBtn");
    const bulkEmptyBtn = shadow.getElementById("bulkEmptyBtn");
    const updateKtpBtn = shadow.getElementById("updateKtpBtn");
    const openFullBtn = shadow.getElementById("openFullBtn");

    async function setOpen(open) {
        if (open) {
            panel.classList.remove("collapsed");
            rail.style.display = "none";
        } else {
            panel.classList.add("collapsed");
            rail.style.display = "flex";
        }
        try { await chrome.storage.local.set({ [STATE_KEY]: open }); } catch { }
    }

    rail.addEventListener("click", () => setOpen(true));
    closeBtn.addEventListener("click", () => setOpen(false));

    // Кнопки запуска тура
    tourBtn.addEventListener("click", () => showTour().catch((e) => console.warn("[mesh-helper] tour failed:", e)));
    restartTourBtn.addEventListener("click", () => showTour().catch((e) => console.warn("[mesh-helper] tour failed:", e)));

    // ============================================================
    // Toast
    // ============================================================
    const panelToast = shadow.getElementById("panelToast");
    let toastTimer = null;
    function toast(text, type = "") {
        panelToast.textContent = text;
        panelToast.className = "panel-toast show " + type;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => panelToast.classList.remove("show"), 3000);
    }

    // ============================================================
    // Кнопки
    // ============================================================
    async function sendMsg(msg) {
        try { return await chrome.runtime.sendMessage(msg); }
        catch (e) { return { ok: false, error: String(e) }; }
    }

    refreshAllBtn.addEventListener("click", async () => {
        refreshAllBtn.disabled = true;
        refreshAllBtn.textContent = "Обновляю…";
        toast("Получаю токен…");

        const tokenRes = await sendMsg({ type: "refreshToken" });
        if (tokenRes?.success) toast("Токен обновлён", "ok");
        else if (tokenRes?.skipped) toast("Использую текущий токен");
        else toast("Токен не обновлён", "err");

        await sendMsg({ type: "refreshSchedule" });
        await sendMsg({ type: "refreshHomework" });
        await sendMsg({ type: "refreshKtp" });
        await sendMsg({ type: "recalcCriteria" });

        refreshAllBtn.disabled = false;
        refreshAllBtn.textContent = "Обновить данные";
        toast("Данные обновлены", "ok");
        await refreshUI();
    });

    bulkEmptyBtn.addEventListener("click", async () => {
        if (!confirm("Проставить «без ДЗ» на все будущие уроки без ДЗ?")) return;
        bulkEmptyBtn.disabled = true;
        bulkEmptyBtn.textContent = "Заполняю…";
        toast("Заполняю ДЗ…");

        const r = await sendMsg({ type: "bulkSetEmpty" });
        if (r?.ok) toast(`Обработано ${r.ok_count} из ${r.total}`, r.failed?.length ? "err" : "ok");
        else toast("Ошибка: " + (r?.error || ""), "err");

        bulkEmptyBtn.disabled = false;
        bulkEmptyBtn.textContent = "Заполнить все без ДЗ";
        await refreshUI();
    });

    updateKtpBtn.addEventListener("click", async () => {
        const { ktp } = await chrome.storage.local.get("ktp");
        const noPlan = (ktp || []).filter((k) => !k.hasPlan || !k.id);

        let msg = "Обновить все КТП? Может занять 10–30 сек.";
        if (noPlan.length > 0) {
            msg = `Обновить все КТП?\n\n⚠️ Для ${noPlan.length} групп(ы) нет плана в МЭШ — они не будут обновлены:\n` +
                noPlan.slice(0, 5).map((k) => " • " + (k.groupName || k.groupId)).join("\n") +
                (noPlan.length > 5 ? `\n … и ещё ${noPlan.length - 5}` : "");
        }
        if (!confirm(msg)) return;

        updateKtpBtn.disabled = true;
        updateKtpBtn.textContent = "Обновляю…";
        toast("Обновляю все КТП…");

        const r = await sendMsg({ type: "updateAllKtp" });
        if (r?.ok) {
            let text = `Обновлено ${r.ok_count} из ${r.total}`;
            if (r.noPlanCount > 0) text += `. Без плана: ${r.noPlanCount}`;
            toast(text, r.failed?.length || r.noPlanCount ? "err" : "ok");
        } else {
            toast("Ошибка: " + (r?.error || ""), "err");
        }

        updateKtpBtn.disabled = false;
        updateKtpBtn.textContent = "Обновить все КТП";
        await refreshUI();
    });

    openFullBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "openDashboard" }).catch(() => { });
    });

    // ============================================================
    // Настройки
    // ============================================================
    const setAutoLaunch = shadow.getElementById("setAutoLaunch");
    const setAutoKtp = shadow.getElementById("setAutoKtp");
    const setCatchUp = shadow.getElementById("setCatchUp");
    const setLastKtp = shadow.getElementById("setLastKtp");

    async function loadSettingsUI() {
        try {
            const { settings, lastKtpUpdateAt } = await chrome.storage.local.get(["settings", "lastKtpUpdateAt"]);
            const s = settings || {};
            setAutoLaunch.checked = s.autoLaunch !== false;
            setAutoKtp.checked = !!s.autoKtpUpdate;
            setCatchUp.value = s.catchUpMinutes ?? 60;
            setLastKtp.textContent = lastKtpUpdateAt ? timeAgo(lastKtpUpdateAt) : "никогда";
        } catch (e) {
            console.warn("[mesh-helper] loadSettingsUI error:", e);
        }
    }

    async function saveSettingsUI() {
        const patch = {
            autoLaunch: setAutoLaunch.checked,
            autoKtpUpdate: setAutoKtp.checked,
            catchUpMinutes: clampInt(setCatchUp.value, 0, 180, 60)
        };
        const r = await sendMsg({ type: "updateSettings", settings: patch });
        if (!r?.ok) console.warn("[mesh-helper] updateSettings failed:", r?.error);
        toast("Настройки сохранены", "ok");
    }

    function clampInt(v, min, max, def) {
        const n = parseInt(v, 10);
        if (isNaN(n)) return def;
        return Math.max(min, Math.min(max, n));
    }

    setAutoLaunch.addEventListener("change", saveSettingsUI);
    setAutoKtp.addEventListener("change", saveSettingsUI);
    setCatchUp.addEventListener("change", saveSettingsUI);

    // ============================================================
    // Отрисовка
    // ============================================================
    const critBadge = shadow.getElementById("critBadge");
    const critPeriod = shadow.getElementById("critPeriod");
    const critSummary = shadow.getElementById("critSummary");
    const hwVal = shadow.getElementById("hwVal");
    const ktpVal = shadow.getElementById("ktpVal");
    const launchVal = shadow.getElementById("launchVal");
    const hwBar = shadow.getElementById("hwBar");
    const ktpBar = shadow.getElementById("ktpBar");
    const launchBar = shadow.getElementById("launchBar");
    const railBadge = shadow.getElementById("railBadge");
    const lessonsList = shadow.getElementById("lessonsList");
    const lessonsCount = shadow.getElementById("lessonsCount");
    const hwPeriods = shadow.getElementById("hwPeriods");
    const hwCount = shadow.getElementById("hwCount");
    const ktpCount = shadow.getElementById("ktpCount");
    const ktpOkList = shadow.getElementById("ktpOkList");
    const ktpProblemList = shadow.getElementById("ktpProblemList");
    const ktpLastUpdate = shadow.getElementById("ktpLastUpdate");
    const lessonStatusBox = shadow.getElementById("lessonStatusBox");
    const lessonStatusText = shadow.getElementById("lessonStatusText");
    const lessonStatusSub = shadow.getElementById("lessonStatusSub");

    function num(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }

    function escapeHtml(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function truncate(s, max = 30) {
        const str = String(s ?? "");
        return str.length > max ? str.slice(0, max - 1) + "…" : str;
    }

    function timeAgo(iso) {
        if (!iso) return "—";
        const diff = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return "только что";
        if (min < 60) return `${min} мин назад`;
        const h = Math.floor(min / 60);
        if (h < 24) return `${h} ч назад`;
        const d = Math.floor(h / 24);
        return `${d} дн назад`;
    }

    async function refreshUI() {
        let state;
        try {
            state = await chrome.storage.local.get([
                "criteria", "meshToken", "period", "schedule", "ktp", "user",
                "lastKtpUpdateAt", "settings"
            ]);
        } catch (e) {
            console.warn("[mesh-helper] refreshUI: storage read failed", e);
            return;
        }

        safeRender("criteria", () => renderCriteriaBlock(state));
        safeRender("lessons", () => renderLessons(state.schedule || []));
        safeRender("homework", () => renderHomework(state.schedule || []));
        safeRender("ktp", () => renderKtp(state.ktp || []));

        try {
            await renderLessonStatus(state.settings);
        } catch (e) {
            console.warn("[mesh-helper] renderLessonStatus failed:", e);
        }
    }

    function safeRender(name, fn) {
        try { fn(); }
        catch (e) {
            console.warn(`[mesh-helper] ${name} render failed:`, e);
        }
    }

    function renderCriteriaBlock(state) {
        const { criteria, meshToken, period, user, lastKtpUpdateAt } = state;

        const t = criteria?.token || { valid: false, minutesLeft: 0 };

        if (!meshToken) {
            critBadge.textContent = "нет токена";
            critBadge.className = "crit-badge err";
            critPeriod.textContent = "Токен МЭШ не подключён";
            railBadge.textContent = "нет";
            railBadge.className = "rail-badge err";
            rail.className = "rail err";
        } else if (!t.valid) {
            critBadge.textContent = "токен истёк";
            critBadge.className = "crit-badge err";
            railBadge.textContent = "!";
            railBadge.className = "rail-badge err";
            rail.className = "rail err";
        } else {
            const h = Math.floor(t.minutesLeft / 60);
            const m = t.minutesLeft % 60;
            railBadge.textContent = h > 0 ? `${h}ч` : `${m}м`;
            railBadge.className = "rail-badge";
            rail.className = "rail";
        }

        if (criteria && typeof criteria.total_lessons === "number") {
            if (criteria.overall_passed) {
                critBadge.textContent = "✓ Выполнены";
                critBadge.className = "crit-badge ok";
            } else if (!criteria.overall_reachable) {
                critBadge.textContent = "✕ Недостижимы";
                critBadge.className = "crit-badge err";
            } else {
                critBadge.textContent = "⚠ В процессе";
                critBadge.className = "crit-badge warn";
            }

            if (period?.from && period?.to) {
                const [, fm, fd] = period.from.split("-");
                const [, tm, td] = period.to.split("-");
                critPeriod.textContent = `Период: ${fd}.${fm} — ${td}.${tm} · уроков: ${criteria.total_lessons}`;
            }
            critSummary.textContent = `Прошло: ${criteria.total_past || 0} · Впереди: ${criteria.total_future || 0}` +
                (user?.lastName ? ` · ${user.lastName}` : "");

            const hw = criteria.hw || {};
            const ktpCr = criteria.ktp || {};
            const lch = criteria.launch || {};

            const hwP = num(hw.percent);
            const ktpP = num(ktpCr.percent);
            const lchP = num(lch.percent);

            hwVal.textContent = hwP.toFixed(1) + "%";
            ktpVal.textContent = ktpP.toFixed(1) + "%";
            launchVal.textContent = lchP.toFixed(1) + "%";

            hwBar.style.width = Math.min(100, hwP) + "%";
            hwBar.className = "bar-fill " + (hw.passed ? "ok" : hwP >= (hw.target || 95) * 0.7 ? "warn" : "err");
            ktpBar.style.width = Math.min(100, ktpP) + "%";
            ktpBar.className = "bar-fill " + (ktpCr.passed ? "ok" : ktpP >= (ktpCr.target || 95) * 0.7 ? "warn" : "err");
            launchBar.style.width = Math.min(100, lchP) + "%";
            launchBar.className = "bar-fill " + (lch.passed ? "ok" : lchP >= (lch.target || 30) * 0.7 ? "warn" : "err");
        } else {
            critBadge.textContent = "—";
            critBadge.className = "crit-badge";
            critPeriod.textContent = "Нажмите «Обновить данные»";
            critSummary.textContent = "";
        }

        ktpLastUpdate.textContent = timeAgo(lastKtpUpdateAt);
        setLastKtp.textContent = lastKtpUpdateAt ? timeAgo(lastKtpUpdateAt) : "никогда";
    }

    async function renderLessonStatus(settings) {
        let res = null, tabRes = null;
        try {
            res = await sendMsg({ type: "getCurrentLessonStatus" });
            tabRes = await sendMsg({ type: "checkCurrentLessonTab" });
        } catch (e) {
            console.warn("[mesh-helper] renderLessonStatus: sendMsg failed", e);
        }

        if (!res?.ok) {
            lessonStatusBox.className = "lesson-status";
            lessonStatusText.textContent = "Нет данных";
            lessonStatusSub.textContent = "";
            return;
        }

        const { current, upcoming, lastLaunch, autoLaunch } = res;

        if (current) {
            const name = current.lessonName || current.subjectName || "Урок";
            const time = current.time || "";
            const tabOpen = tabRes?.tabOpen;

            lessonStatusBox.className = "lesson-status " + (tabOpen ? "ok" : "err");

            if (tabOpen) {
                lessonStatusText.innerHTML = `<span class="lesson-status-tag ok">сейчас</span>Запущен урок «${escapeHtml(name)}»`;
                lessonStatusSub.textContent = `${time} · вкладка с уроком открыта`;
            } else {
                lessonStatusText.innerHTML = `<span class="lesson-status-tag err">вкладка закрыта</span>Урок «${escapeHtml(name)}» должен быть запущен`;
                lessonStatusSub.textContent = `${time} · вкладка с уроком не открыта. Откройте вручную или запустите заново.`;
            }
            return;
        }

        if (lastLaunch?.status === "error" && lastLaunch.info) {
            const info = lastLaunch.info;
            lessonStatusBox.className = "lesson-status err";
            lessonStatusText.innerHTML = `<span class="lesson-status-tag err">ошибка</span>Урок «${escapeHtml(info.lessonName || "—")}» не запустился`;
            lessonStatusSub.textContent = `${info.time || ""} · ${info.error || "неизвестная ошибка"}`;
            return;
        }

        if (upcoming) {
            const name = upcoming.lessonName || upcoming.subjectName || "Урок";
            const time = upcoming.time || "";
            const diffMin = Math.round((new Date(upcoming.startAt) - Date.now()) / 60000);
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            const when = h > 0 ? `${h} ч ${m} мин` : `${m} мин`;

            lessonStatusBox.className = "lesson-status";
            lessonStatusText.innerHTML = `<span class="lesson-status-tag warn">ожидание</span>Ближайший урок «${escapeHtml(name)}»`;
            lessonStatusSub.textContent = `${time} · откроется через ${when}`;
            return;
        }

        lessonStatusBox.className = "lesson-status";
        lessonStatusText.textContent = "На сегодня уроков не осталось";
        lessonStatusSub.textContent = autoLaunch ? "Автозапуск включён" : "Автозапуск выключен";
    }

    function renderLessons(schedule) {
        try {
            const safe = Array.isArray(schedule) ? schedule : [];
            const now = new Date();
            const today = new Date().toISOString().slice(0, 10);

            const todayLessons = safe
                .filter((l) => l && l.date === today)
                .map((l) => ({ ...l, diffMin: (new Date(l.startAt) - now) / 60000 }))
                .sort((a, b) => a.diffMin - b.diffMin);

            lessonsCount.innerHTML = `<b>${todayLessons.length}</b> за сегодня`;

            if (!todayLessons.length) {
                lessonsList.innerHTML = `<div class="empty">На сегодня уроков нет</div>`;
                return;
            }

            lessonsList.innerHTML = todayLessons.slice(0, 12).map((l) => {
                let cls = "";
                let statusText = "";
                let statusCls = "";

                const canLaunchLesson = !!(l.launchUrl || l.scriptUuid);
                const isDone = l.status === "finished" || l.is_launched;
                const isRunning = l.status === "running";
                const isFailed = l.status === "failed";

                if (!canLaunchLesson) statusText = "нет ссылки на запуск";
                else if (isDone) { cls = "ok"; statusText = "✓ проведён"; statusCls = "ok"; }
                else if (isRunning) { cls = "ok"; statusText = "⚙ идёт сейчас"; statusCls = "ok"; }
                else if (isFailed) { cls = "err"; statusText = "✕ ошибка запуска"; statusCls = "err"; }
                else {
                    if (l.diffMin < 0) { statusText = "ещё не был запущен сегодня"; statusCls = "warn"; }
                    else if (l.diffMin < 5) { cls = "warn"; statusText = "запускается"; statusCls = "warn"; }
                    else if (l.diffMin < 60) statusText = `через ${Math.round(l.diffMin)} мин`;
                    else {
                        const h = Math.floor(l.diffMin / 60);
                        const m = Math.round(l.diffMin % 60);
                        statusText = `через ${h} ч ${m} мин`;
                    }
                }

                const rawGroup = l.groupName || "";
                const rawTopic = l.lessonName || l.subjectName || "";
                const classMatch = rawGroup.match(/\d{1,2}\s*[-–]?\s*[А-Яа-яA-Za-z]?/);
                const classLabel = classMatch ? classMatch[0].trim() : rawGroup;
                const showPlay = canLaunchLesson && !isDone && !isRunning;

                return `
          <div class="item ${cls}" data-lesson-id="${l.id}">
            <div class="item-row">
              <div class="item-main">
                <div class="item-class" title="${escapeHtml(rawGroup)}">${escapeHtml(classLabel || rawGroup)}</div>
                <div class="item-topic" title="${escapeHtml(rawTopic)}">${escapeHtml(truncate(rawTopic, 34))}</div>
              </div>
              <div class="item-timebox">
                <div class="item-time">${escapeHtml(l.time || "")}</div>
                <div class="item-status ${statusCls}">${escapeHtml(statusText)}</div>
              </div>
              ${showPlay ? `<div class="item-actions"><button class="btn-play" data-action="launch" title="Запустить урок">▶</button></div>` : ""}
            </div>
          </div>
        `;
            }).join("");

            lessonsList.querySelectorAll("button[data-action='launch']").forEach((btn) => {
                btn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const item = btn.closest("[data-lesson-id]");
                    const lessonId = item?.dataset?.lessonId;
                    if (!lessonId) return;

                    btn.disabled = true;
                    btn.textContent = "…";
                    toast("Запускаю урок…");

                    const { schedule } = await chrome.storage.local.get("schedule");
                    const lesson = (schedule || []).find((l) => String(l.id) === String(lessonId));
                    if (!lesson) { toast("Урок не найден", "err"); return; }

                    const r = await sendMsg({ type: "launchNow", lesson });
                    if (r?.ok) { toast("Урок запущен", "ok"); await refreshUI(); }
                    else { toast("Ошибка: " + (r?.error || ""), "err"); btn.disabled = false; btn.textContent = "▶"; }
                });
            });
        } catch (e) {
            console.warn("[mesh-helper] renderLessons error:", e);
        }
    }

    function renderHomework(schedule) {
        try {
            const safe = Array.isArray(schedule) ? schedule : [];
            const today = new Date().toISOString().slice(0, 10);

            const byDate = new Map();
            for (const l of safe) {
                if (!l || !l.date) continue;
                if (!byDate.has(l.date)) byDate.set(l.date, []);
                byDate.get(l.date).push(l);
            }
            for (const arr of byDate.values()) {
                arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            }

            const dates = [...byDate.keys()].sort();
            if (!dates.length) {
                hwPeriods.innerHTML = `<div class="empty">Нет данных расписания. Нажмите «Обновить данные».</div>`;
                hwCount.innerHTML = "";
                return;
            }

            const periods = [];
            const first = parseDate(dates[0]);
            const last = parseDate(dates[dates.length - 1]);

            let cur = new Date(first);
            while (cur <= last) {
                const d = cur.getDate();
                let from, to;
                if (d >= 16) {
                    from = new Date(cur.getFullYear(), cur.getMonth(), 16);
                    to = new Date(cur.getFullYear(), cur.getMonth() + 1, 15);
                } else {
                    from = new Date(cur.getFullYear(), cur.getMonth() - 1, 16);
                    to = new Date(cur.getFullYear(), cur.getMonth(), 15);
                }

                const fromIso = isoOf(from);
                const toIso = isoOf(to);
                const periodLessons = [];
                for (const date of dates) {
                    if (date >= fromIso && date <= toIso) {
                        periodLessons.push(...byDate.get(date));
                    }
                }
                if (periodLessons.length > 0) {
                    periods.push({ from: fromIso, to: toIso, lessons: periodLessons });
                }

                cur = new Date(to);
                cur.setDate(cur.getDate() + 1);
            }

            const totalWithoutHw = safe.filter((l) => l.date >= today && !l.has_homework).length;
            hwCount.innerHTML = `без ДЗ: <b>${totalWithoutHw}</b>`;

            hwPeriods.innerHTML = periods.map((p) => {
                const isCurrent = p.from <= today && p.to >= today;
                const isPast = p.to < today;

                const total = p.lessons.length;
                const withHw = p.lessons.filter((l) => l.has_homework).length;
                const futureWithout = p.lessons.filter((l) => l.date >= today && !l.has_homework).length;

                const weeks = groupByWeeks(p.lessons);

                const weeksHtml = weeks.map((w) => {
                    const daysHtml = w.days.map((day) => {
                        const isToday = day.date === today;
                        const isPastDay = day.date < today;
                        const [, m, d] = day.date.split("-");

                        const sorted = [...day.lessons].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
                        const squares = [];
                        for (let i = 0; i < sorted.length; i++) {
                            const lesson = sorted[i];

                            let cls = "hw-sq ";
                            if (lesson.has_homework) cls += "has";
                            else if (day.date < today) cls += "missing-past";
                            else cls += "missing-future";

                            const title = `${lesson.time || ""} ${lesson.lessonName || lesson.subjectName || ""} — ${lesson.has_homework ? "ДЗ задано" : "ДЗ не задано"}`;
                            squares.push(`<div class="${cls}" title="${escapeHtml(title)}" data-lesson-id="${lesson.id}"></div>`);

                            const next = sorted[i + 1];
                            if (next) {
                                const gap = gapMinutes(lesson.time, next.time);
                                if (gap >= 20) {
                                    squares.push(`<div class="hw-sq window" title="Окно учителя · ${gap} мин"></div>`);
                                }
                            }
                        }

                        return `
              <div class="hw-day ${isToday ? "today" : ""} ${isPastDay ? "past" : ""}" title="${day.date}">
                <div class="hw-day-date">${d}.${m}</div>
                <div class="hw-squares">${squares.join("")}</div>
              </div>
            `;
                    }).join("");
                    return daysHtml;
                }).join("");

                const [, fm, fd] = p.from.split("-");
                const [, tm, td] = p.to.split("-");

                return `
          <div class="hw-period ${isPast ? "past" : ""}">
            <div class="hw-period-title">
              <span>${fd}.${fm} — ${td}.${tm}</span>
              ${isCurrent ? '<span class="tag">текущий</span>' : ""}
            </div>
            <div class="hw-period-stats">
              <span>уроков: <b>${total}</b></span>
              <span>с ДЗ: <b>${withHw}</b></span>
              ${futureWithout > 0 ? `<span style="color:#FBBF24">без ДЗ: <b>${futureWithout}</b></span>` : ""}
            </div>
            <div class="hw-grid">${weeksHtml}</div>
          </div>
        `;
            }).join("");

            hwPeriods.querySelectorAll(".hw-sq:not(.window)").forEach((sq) => {
                sq.addEventListener("click", () => {
                    chrome.runtime.sendMessage({ type: "openDashboard" }).catch(() => { });
                });
            });
        } catch (e) {
            console.warn("[mesh-helper] renderHomework error:", e);
        }
    }

    function renderKtp(ktp) {
        try {
            const safe = Array.isArray(ktp) ? ktp : [];
            ktpCount.innerHTML = `<b>${safe.length}</b> групп`;

            const okItems = safe.filter((k) => k.done);
            const problemItems = safe.filter((k) => !k.done);

            if (okItems.length) {
                ktpOkList.innerHTML = okItems.map((k) => {
                    const planTag = k.hasPlan ? "" : " · нет плана в МЭШ";
                    return `<span class="ktp-ok-item" title="${escapeHtml(k.groupName || "")}${planTag}">${escapeHtml(truncate(k.groupName || "Группа", 32))}</span>`;
                }).join("");
            } else {
                ktpOkList.innerHTML = "";
            }

            if (problemItems.length) {
                ktpProblemList.innerHTML = problemItems.map((k) => {
                    const name = k.groupName || `Группа ${k.groupId}`;
                    const total = k.total || 0;
                    const withDate = k.withDate || 0;
                    const withoutDate = k.withoutDate || 0;
                    const hasPlan = !!(k.hasPlan && k.id);

                    return `
            <div class="ktp-problem ${hasPlan ? "" : "no-plan"}" data-plan-id="${hasPlan ? k.id : ""}">
              <div class="ktp-problem-head">
                <span class="ktp-problem-name" title="${escapeHtml(name)}">${escapeHtml(truncate(name, 28))}</span>
                ${hasPlan ? "" : `<span class="ktp-problem-tag">нет плана</span>`}
              </div>
              <div class="ktp-problem-stats">
                <span>уроков: <b>${total}</b></span>
                <span class="ok">привязано: <b>${withDate}</b></span>
                <span>без темы: <b>${withoutDate}</b></span>
              </div>
              ${hasPlan
                            ? `<button class="btn-small btn-primary" data-action="update-ktp" data-plan-id="${k.id}">Обновить КТП</button>`
                            : `<div class="ktp-problem-hint">План не создан в МЭШ. Откройте МЭШ → Планирование → создайте план для этого класса.</div>`}
            </div>
          `;
                }).join("");

                ktpProblemList.querySelectorAll("button[data-action='update-ktp']").forEach((btn) => {
                    btn.addEventListener("click", async () => {
                        const planId = btn.dataset.planId;
                        if (!planId) return;

                        btn.disabled = true;
                        const oldText = btn.textContent;
                        btn.textContent = "Обновляю…";
                        toast("Обновляю КТП…");

                        const r = await sendMsg({ type: "updateOneKtp", planId: Number(planId) });

                        if (r?.ok) {
                            toast("КТП обновлено, обновляю данные…", "ok");
                            await sendMsg({ type: "refreshSchedule" });
                            await sendMsg({ type: "refreshKtp" });
                            await sendMsg({ type: "recalcCriteria" });
                            toast("Данные обновлены", "ok");
                        } else {
                            toast("Ошибка: " + (r?.error || ""), "err");
                            btn.disabled = false;
                            btn.textContent = oldText;
                        }

                        await refreshUI();
                    });
                });
            } else {
                if (okItems.length === 0) {
                    ktpProblemList.innerHTML = `<div class="empty">Нет данных КТП</div>`;
                } else {
                    ktpProblemList.innerHTML = "";
                }
            }
        } catch (e) {
            console.warn("[mesh-helper] renderKtp error:", e);
        }
    }

    function gapMinutes(prevTime, nextTime) {
        const LESSON_DURATION_MIN = 45;
        const prevEnd = toMin(prevTime) + LESSON_DURATION_MIN;
        const nextStart = toMin(nextTime);
        return nextStart - prevEnd;
    }
    function toMin(hhmm) {
        if (!hhmm) return 0;
        const [h, m] = hhmm.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }
    function groupByWeeks(lessons) {
        const byDate = new Map();
        for (const l of lessons) {
            if (!l || !l.date) continue;
            if (!byDate.has(l.date)) byDate.set(l.date, []);
            byDate.get(l.date).push(l);
        }
        for (const arr of byDate.values()) {
            arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        }

        const dates = [...byDate.keys()].sort();
        const weeks = [];
        let currentWeek = [];
        let lastMonday = "";

        for (const date of dates) {
            const d = parseDate(date);
            const dow = d.getDay();
            const diffToMon = dow === 0 ? -6 : 1 - dow;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diffToMon);
            const mondayIso = isoOf(monday);

            if (lastMonday && mondayIso !== lastMonday) {
                weeks.push({ days: currentWeek });
                currentWeek = [];
            }
            lastMonday = mondayIso;
            currentWeek.push({ date, lessons: byDate.get(date) || [] });
        }
        if (currentWeek.length) weeks.push({ days: currentWeek });
        return weeks;
    }
    function parseDate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    function isoOf(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // ============================================================
    // ONBOARDING-ТУР
    // ============================================================
    const TOUR_STEPS = [
        {
            title: "Критерии надбавки",
            text: "Здесь видно, выполняются ли критерии надбавки за текущий отчётный период (16 → 15). Три прогресс-бара: ДЗ, КТП и Запуск уроков.",
            highlightSelector: "#tour-crit-header",
            cursorAt: "center"
        },
        {
            title: "Обновить данные",
            text: "Нажмите сюда, чтобы обновить расписание, ДЗ, КТП и критерии из МЭШ. Токен тоже обновится автоматически.",
            highlightSelector: '[data-tour="refresh"]',
            cursorAt: "center"
        },
        {
            title: "Заполнить все без ДЗ",
            text: "Одним кликом проставит «Без домашнего задания» на все будущие уроки, где ДЗ ещё не задано. Экономит часы рутины.",
            highlightSelector: '[data-tour="bulk"]',
            cursorAt: "center"
        },
        {
            title: "Обновить все КТП",
            text: "Обновит все КТП: достроит даты и пересчитает темы. Если для класса нет плана в МЭШ — расширение предупредит.",
            highlightSelector: '[data-tour="ktp-update"]',
            cursorAt: "center"
        },
        {
            title: "Открыть полную панель",
            text: "Откроет расширенное окно с календарями ДЗ, списком уроков и КТП по группам.",
            highlightSelector: '[data-tour="open-full"]',
            cursorAt: "center"
        },
        {
            title: "Статус урока",
            text: "Показывает, что происходит сейчас: идёт ли урок, открыта ли вкладка, был ли запущен или произошла ошибка.",
            highlightSelector: '[data-tour="lesson-status"]',
            cursorAt: "center"
        },
        {
            title: "Ближайшие уроки",
            text: "Список уроков на сегодня. Для pending-уроков есть кнопка ▶ — можно запустить вручную.",
            highlightSelector: '[data-tour="lessons"]',
            cursorAt: "center"
        },
        {
            title: "Домашние задания",
            text: "Календарь ДЗ по отчётным периодам. Зелёный = ДЗ задано, красный = пропущено, жёлтый = ещё не задано.",
            highlightSelector: '[data-tour="homework"]',
            cursorAt: "center"
        },
        {
            title: "КТП по группам",
            text: "Показывает, у каких групп есть непривязанные уроки. Для каждой можно обновить КТП одной кнопкой.",
            highlightSelector: '[data-tour="ktp"]',
            cursorAt: "center"
        },
        {
            title: "Настройки",
            text: "Здесь можно включить автозапуск уроков, автообновление КТП раз в сутки и настроить окно догона пропущенных уроков.",
            highlightSelector: '[data-tour="settings"]',
            cursorAt: "center"
        },
        {
            title: "Готово!",
            text: "Тур завершён. Открывайте панель в любой момент кликом по ярлыку «Помощник в МЭШ» справа. Кнопка «?» в шапке запустит обучение заново.",
            highlightSelector: null,
            cursorAt: null
        }
    ];

    const tourState = {
        active: false,
        index: 0,
        overlay: null,
        spotlight: null,
        tip: null,
        cursor: null,
        mask: null
    };

    function buildTour() {
        const overlay = document.createElement("div");
        overlay.className = "tour-overlay";

        const mask = document.createElement("div");
        mask.className = "tour-mask";

        const spotlight = document.createElement("div");
        spotlight.className = "tour-spotlight";

        const tip = document.createElement("div");
        tip.className = "tour-tip";

        const cursor = document.createElement("div");
        cursor.className = "tour-cursor";
        cursor.innerHTML = `
      <div class="tour-cursor-ripple"></div>
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 2 L4 18 L9 14 L12 22 L15 20 L12 13 L19 13 Z"
              fill="#fff" stroke="#0B1220" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    `;

        overlay.appendChild(mask);
        overlay.appendChild(spotlight);
        overlay.appendChild(tip);
        overlay.appendChild(cursor);

        shadow.appendChild(overlay);

        tourState.overlay = overlay;
        tourState.mask = mask;
        tourState.spotlight = spotlight;
        tourState.tip = tip;
        tourState.cursor = cursor;
    }

    async function showTour() {
        // Раскроем панель, чтобы элементы были видны
        await setOpen(true);
        await new Promise((r) => setTimeout(r, 350));

        if (!tourState.overlay) buildTour();
        tourState.overlay.classList.add("show");
        tourState.active = true;
        tourState.index = 0;
        showStep(0);
    }

    function hideTour() {
        if (tourState.overlay) tourState.overlay.classList.remove("show");
        tourState.active = false;
        chrome.storage.local.set({ [TOUR_KEY]: true });
    }

    function showStep(idx) {
        if (idx >= TOUR_STEPS.length) {
            hideTour();
            return;
        }

        const step = TOUR_STEPS[idx];
        tourState.index = idx;

        const spotlight = tourState.spotlight;
        const tip = tourState.tip;
        const cursor = tourState.cursor;

        let target = null;
        if (step.highlightSelector) {
            target = shadow.querySelector(step.highlightSelector);
        }

        const rect = target ? target.getBoundingClientRect() : null;
        const pad = 8;

        if (rect) {
            spotlight.style.display = "block";
            spotlight.style.left = (rect.left - pad) + "px";
            spotlight.style.top = (rect.top - pad) + "px";
            spotlight.style.width = (rect.width + pad * 2) + "px";
            spotlight.style.height = (rect.height + pad * 2) + "px";
        } else {
            spotlight.style.display = "block";
            spotlight.style.left = (window.innerWidth / 2 - 60) + "px";
            spotlight.style.top = (window.innerHeight / 2 - 60) + "px";
            spotlight.style.width = "120px";
            spotlight.style.height = "120px";
        }

        tip.innerHTML = `
      <div class="tour-tip-title">${escapeHtml(step.title)}</div>
      <div class="tour-tip-text">${escapeHtml(step.text)}</div>
      <div class="tour-tip-footer">
        <div class="tour-progress"><b>${idx + 1}</b> / ${TOUR_STEPS.length}</div>
        <div class="tour-btns">
          ${idx > 0 ? `<button class="tour-btn tour-btn-skip" id="tourBackBtn">Назад</button>` : ""}
          <button class="tour-btn tour-btn-skip" id="tourSkipBtn">Пропустить</button>
          <button class="tour-btn tour-btn-primary" id="tourNextBtn">
            ${idx === TOUR_STEPS.length - 1 ? "Готово" : "Далее"}
          </button>
        </div>
      </div>
    `;

        const tipRect = { w: 360, h: 190 };
        let tipLeft, tipTop;

        if (rect) {
            if (rect.right + tipRect.w + 24 < window.innerWidth) {
                tipLeft = rect.right + 24;
                tipTop = rect.top;
            } else if (rect.left - tipRect.w - 24 > 0) {
                tipLeft = rect.left - tipRect.w - 24;
                tipTop = rect.top;
            } else {
                tipLeft = Math.max(16, Math.min(window.innerWidth - tipRect.w - 16, rect.left));
                tipTop = rect.bottom + 24;
                if (tipTop + tipRect.h > window.innerHeight - 16) {
                    tipTop = Math.max(16, rect.top - tipRect.h - 24);
                }
            }
        } else {
            tipLeft = (window.innerWidth - tipRect.w) / 2;
            tipTop = (window.innerHeight - tipRect.h) / 2;
        }

        tip.style.left = tipLeft + "px";
        tip.style.top = tipTop + "px";

        let cursorX, cursorY;
        if (rect) {
            cursorX = rect.left + rect.width / 2 - 4;
            cursorY = rect.top + rect.height / 2 - 4;
        } else {
            cursorX = window.innerWidth / 2;
            cursorY = window.innerHeight / 2;
        }

        cursor.style.left = cursorX + "px";
        cursor.style.top = cursorY + "px";
        cursor.style.opacity = "1";

        setTimeout(() => {
            if (!tourState.active) return;
            cursor.classList.remove("click");
            void cursor.offsetWidth;
            cursor.classList.add("click");
        }, 300);

        const backBtn = tip.querySelector("#tourBackBtn");
        const skipBtn = tip.querySelector("#tourSkipBtn");
        const nextBtn = tip.querySelector("#tourNextBtn");

        if (backBtn) backBtn.addEventListener("click", () => showStep(idx - 1));
        skipBtn.addEventListener("click", () => hideTour());
        nextBtn.addEventListener("click", () => showStep(idx + 1));
    }

    // ============================================================
    // Подписки
    // ============================================================
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.meshToken || changes.criteria || changes.schedule || changes.ktp || changes.user ||
            changes.lastKtpUpdateAt || changes.settings || changes.lastLessonLaunchAt) {
            refreshUI();
            if (changes.settings) {
                try {
                    const s = changes.settings.newValue || {};
                    setAutoLaunch.checked = s.autoLaunch !== false;
                    setAutoKtp.checked = !!s.autoKtpUpdate;
                    setCatchUp.value = s.catchUpMinutes ?? 60;
                } catch (e) {
                    console.warn("[mesh-helper] settings UI update failed:", e);
                }
            }
        }
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "refreshBadge") refreshUI();
    });

    setInterval(refreshUI, 15000);

    // ============================================================
    // Старт
    // ============================================================
    (async function init() {
        try {
            const { [TOUR_KEY]: shown, [STATE_KEY]: open } = await chrome.storage.local.get([TOUR_KEY, STATE_KEY]);

            if (open) await setOpen(true);
            else { panel.classList.add("collapsed"); rail.style.display = "flex"; }

            await refreshUI();
            await loadSettingsUI();

            if (!shown) {
                setTimeout(() => {
                    showTour().catch((e) => console.warn("[mesh-helper] tour failed:", e));
                }, 800);
            }

            console.log("[content-script] panel ready");
        } catch (e) {
            console.warn("[content-script] init error:", e);
            panel.classList.add("collapsed");
            rail.style.display = "flex";
        }
    })();
})();