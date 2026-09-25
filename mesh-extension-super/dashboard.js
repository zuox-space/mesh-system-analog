// dashboard.js
import { getState } from "./storage.js";
import { renderHomeworkCalendar } from "./tabs/homework.js";
import { renderKtp } from "./tabs/ktp.js";
import { renderLessonsCalendar } from "./tabs/lessons.js";
import { neededToTarget } from "./criteria.js";

async function sendMsg(msg, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await chrome.runtime.sendMessage(msg);
      if (r !== undefined) return r;
    } catch (e) { }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { ok: false, error: "Нет ответа" };
}

let toastTimer = null;
function toast(text, type = "") {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.className = "toast " + type;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 3000);
}

// ===== DOM =====
const statusDot = document.getElementById("statusDot");
const criteriaBadge = document.getElementById("criteriaBadge");
const criteriaPeriod = document.getElementById("criteriaPeriod");
const criteriaSummary = document.getElementById("criteriaSummary");
const critHwVal = document.getElementById("critHwVal");
const critKtpVal = document.getElementById("critKtpVal");
const critLaunchVal = document.getElementById("critLaunchVal");
const critHwMeta = document.getElementById("critHwMeta");
const critKtpMeta = document.getElementById("critKtpMeta");
const critLaunchMeta = document.getElementById("critLaunchMeta");
const barHw = document.getElementById("barHw");
const barKtp = document.getElementById("barKtp");
const barLaunch = document.getElementById("barLaunch");
const critToken = document.getElementById("critToken");

const userBlock = document.getElementById("userBlock");
const userName = document.getElementById("userName");
const userRole = document.getElementById("userRole");

// ===== Modal =====
const modal = document.getElementById("modal");
const modalBg = document.getElementById("modalBg");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");
const modalText = document.getElementById("modalText");
const modalMeta = document.getElementById("modalMeta");
const modalTitle = document.getElementById("modalTitle");

let currentLesson = null;

function openModal(lesson) {
  currentLesson = lesson;
  modalMeta.textContent = `${lesson.date} · ${lesson.time || ""} · ${lesson.groupName || ""}`;
  modalTitle.textContent = lesson.title || lesson.lessonName || "Урок";
  modalText.value = "Без домашнего задания";
  modal.style.display = "flex";
  setTimeout(() => modalText.focus(), 50);
}

function closeModal() {
  modal.style.display = "none";
  currentLesson = null;
}

modalBg.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);
modalSave.addEventListener("click", async () => {
  if (!currentLesson) return;
  const desc = modalText.value.trim();
  if (!desc) { toast("Введите текст ДЗ", "err"); return; }
  modalSave.disabled = true;
  const r = await sendMsg({ type: "setCustomHomework", lessonId: currentLesson.id, description: desc });
  modalSave.disabled = false;
  if (r?.ok) {
    toast("ДЗ задано", "ok");
    closeModal();
    await renderAll();
  } else {
    toast("Ошибка: " + (r?.error || ""), "err");
  }
});

// ===== Tabs =====
const tabs = document.querySelectorAll(".tab");
const panels = {
  homework: document.getElementById("panel-homework"),
  ktp: document.getElementById("panel-ktp"),
  lessons: document.getElementById("panel-lessons")
};

tabs.forEach((t) => {
  t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const name = t.dataset.tab;
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[name].classList.add("active");
    renderTab(name);
  });
});

async function renderTab(name) {
  const st = await getState();

  if (name === "homework") {
    renderHomeworkCalendar(panels.homework, st, {
      onOpenLesson: (lesson) => openModal(lesson),
      onBulkEmpty: async () => {
        if (!confirm("Проставить «без ДЗ» на все будущие уроки без ДЗ?")) return;
        toast("Заполняю…");
        const r = await sendMsg({ type: "bulkSetEmpty" });
        if (r?.ok) toast(`Обработано ${r.ok_count} из ${r.total}`, r.failed?.length ? "err" : "ok");
        else toast("Ошибка: " + (r?.error || ""), "err");
        await renderAll();
      }
    });
  }

  if (name === "ktp") {
    renderKtp(panels.ktp, st, {
      onUpdateAll: async () => {
        if (!confirm("Обновить все КТП? Это может занять 10–30 секунд.")) return;
        toast("Обновляю все КТП…");
        const r = await sendMsg({ type: "updateAllKtp" });
        if (r?.ok) toast(`Обновлено ${r.ok_count} из ${r.total}`, r.failed?.length ? "err" : "ok");
        else toast("Ошибка: " + (r?.error || ""), "err");
        await renderAll();
      }
    });
  }

  if (name === "lessons") {
    renderLessonsCalendar(panels.lessons, st, onLaunchNow);
  }
}

// ===== Критерии =====
async function renderCriteria() {
  const { criteria, meshToken, period, user } = await getState([
    "criteria", "meshToken", "period", "user"
  ]);

  if (user) {
    userBlock.style.display = "block";
    userName.textContent = [user.lastName, user.firstName].filter(Boolean).join(" ") || user.email || "—";
    userRole.textContent = "TEACHER";
  }

  const t = (criteria?.token) || { valid: false, minutesLeft: 0 };
  if (!meshToken) critToken.textContent = "нет";
  else if (t.valid) {
    const h = Math.floor(t.minutesLeft / 60);
    const m = t.minutesLeft % 60;
    critToken.textContent = h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  } else critToken.textContent = "истёк";
  statusDot.className = "status-dot " + (t.valid && meshToken ? "ok" : "err");

  if (!criteria || typeof criteria.total_lessons !== "number") {
    criteriaBadge.textContent = "—";
    criteriaBadge.className = "criteria-badge";
    criteriaPeriod.textContent = "Нет данных. Нажмите «Обновить данные».";
    criteriaSummary.textContent = "";
    return;
  }

  if (criteria.overall_passed) {
    criteriaBadge.textContent = "✓ Выполнены";
    criteriaBadge.className = "criteria-badge ok";
  } else if (!criteria.overall_reachable) {
    criteriaBadge.textContent = "✕ Недостижимы";
    criteriaBadge.className = "criteria-badge err";
  } else {
    criteriaBadge.textContent = "⚠ В процессе";
    criteriaBadge.className = "criteria-badge warn";
  }

  if (period?.from && period?.to) {
    criteriaPeriod.textContent = `Период: ${fmt(period.from)} — ${fmt(period.to)} · всего уроков: ${criteria.total_lessons}`;
  }
  criteriaSummary.textContent =
    `Прошло: ${criteria.total_past ?? 0} · Впереди: ${criteria.total_future ?? 0}`;

  const hw = criteria.hw || {};
  const hwP = num(hw.percent);
  critHwVal.textContent = hwP.toFixed(1) + "%";
  critHwMeta.textContent = `${hw.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, hw.target || 95, hw.done || 0)}`;
  barHw.style.width = Math.min(100, hwP) + "%";
  barHw.className = "bar-fill " + (hw.passed ? "ok" : hwP >= (hw.target || 95) * 0.7 ? "warn" : "err");

  const ktp = criteria.ktp || {};
  const ktpP = num(ktp.percent);
  critKtpVal.textContent = ktpP.toFixed(1) + "%";
  critKtpMeta.textContent = `${ktp.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, ktp.target || 95, ktp.done || 0)}`;
  barKtp.style.width = Math.min(100, ktpP) + "%";
  barKtp.className = "bar-fill " + (ktp.passed ? "ok" : ktpP >= (ktp.target || 95) * 0.7 ? "warn" : "err");

  const lch = criteria.launch || {};
  const lchP = num(lch.percent);
  critLaunchVal.textContent = lchP.toFixed(1) + "%";
  critLaunchMeta.textContent = `${lch.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, lch.target || 30, lch.done || 0)}`;
  barLaunch.style.width = Math.min(100, lchP) + "%";
  barLaunch.className = "bar-fill " + (lch.passed ? "ok" : lchP >= (lch.target || 30) * 0.7 ? "warn" : "err");
}

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function fmt(iso) { const [, m, d] = iso.split("-"); return `${d}.${m}`; }

async function onLaunchNow(lessonId) {
  const st = await getState(["schedule"]);
  const lesson = st.schedule.find((l) => String(l.id) === String(lessonId));
  if (!lesson) return;
  const r = await sendMsg({ type: "launchNow", lesson });
  toast(r?.ok ? "Урок запущен" : "Ошибка: " + (r?.error || ""), r?.ok ? "ok" : "err");
  await renderTab("lessons");
}

let refreshing = false;
async function renderAll() {
  if (refreshing) return;
  refreshing = true;
  try {
    await sendMsg({ type: "refreshSchedule" });
    await sendMsg({ type: "refreshHomework" });
    await sendMsg({ type: "refreshKtp" });
    await sendMsg({ type: "recalcCriteria" });
    await renderCriteria();
    const active = document.querySelector(".tab.active");
    if (active) await renderTab(active.dataset.tab);
  } finally { refreshing = false; }
}

document.getElementById("refreshAllBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshAllBtn");
  btn.disabled = true; btn.textContent = "Обновляю...";

  // 1. Сначала попробуем обновить токен (тихо)
  const tokenRes = await sendMsg({ type: "refreshToken" });
  if (!tokenRes?.success) {
    console.warn("[dashboard] refreshToken failed:", tokenRes?.error);
  }

  // 2. Обновим данные
  await renderAll();

  btn.disabled = false; btn.textContent = "Обновить данные";
  toast("Данные обновлены", "ok");
});

(async function init() {
  await renderCriteria();
  await renderTab("homework");
  setInterval(renderCriteria, 5000);
})();

// ============================================================
// Автообновление UI при изменении storage
// ============================================================
let reRenderTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.schedule && !changes.criteria && !changes.meshToken) return;

  clearTimeout(reRenderTimer);
  reRenderTimer = setTimeout(async () => {
    try {
      await renderCriteria();
      const active = document.querySelector(".tab.active");
      if (active) await renderTab(active.dataset.tab);
    } catch (e) {
      console.warn("[dashboard] auto re-render failed:", e);
    }
  }, 300);
});