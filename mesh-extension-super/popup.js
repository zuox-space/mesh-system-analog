// popup.js
import { getState } from "./storage.js";
import { renderHomework } from "./tabs/homework.js";
import { renderKtp } from "./tabs/ktp.js";
import { renderLessons } from "./tabs/lessons.js";
import { neededToTarget } from "./criteria.js";

async function sendMsg(msg, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await chrome.runtime.sendMessage(msg);
      if (r !== undefined) return r;
    } catch (e) {}
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
    renderHomework(panels.homework, st, {
      onSetCustom: async (lesson) => {
        const desc = prompt("Текст домашнего задания:", "Без домашнего задания");
        if (desc === null) return;
        const r = await sendMsg({ type: "setCustomHomework", lessonId: lesson.id, description: desc });
        toast(r?.ok ? "ДЗ задано" : "Ошибка: " + (r?.error || ""), r?.ok ? "ok" : "err");
        await renderAll();
      },
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
    renderLessons(panels.lessons, st, onLaunchNow);
  }
}

async function renderCriteria() {
  const { criteria, meshToken, period, user } = await getState([
    "criteria", "meshToken", "period", "user"
  ]);

  const t = (criteria?.token) || { valid: false, minutesLeft: 0 };
  if (!meshToken) {
    critToken.textContent = "нет";
  } else if (t.valid) {
    const h = Math.floor(t.minutesLeft / 60);
    const m = t.minutesLeft % 60;
    critToken.textContent = h > 0 ? `${h}ч ${m}м` : `${m}м`;
  } else {
    critToken.textContent = "истёк";
  }
  statusDot.className = "status-dot " + (t.valid && meshToken ? "ok" : "err");

  if (!criteria || typeof criteria.total_lessons !== "number") {
    criteriaBadge.textContent = "—";
    criteriaBadge.className = "criteria-badge";
    criteriaPeriod.textContent = "Нет данных. Нажмите «Обновить токен», затем «Обновить данные».";
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
    criteriaPeriod.textContent = `Период: ${fmt(period.from)} — ${fmt(period.to)} · уроков: ${criteria.total_lessons}`;
  }

  criteriaSummary.textContent =
    `Прошло: ${criteria.total_past ?? 0}, впереди: ${criteria.total_future ?? 0}` +
    (user?.lastName ? ` · ${user.lastName} ${user.firstName || ""}` : "");

  const hw = criteria.hw || {};
  const hwPercent = num(hw.percent);
  critHwVal.textContent = hwPercent.toFixed(1) + "%";
  critHwMeta.textContent = `${hw.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, hw.target || 95, hw.done || 0)}`;
  barHw.style.width = Math.min(100, hwPercent) + "%";
  barHw.className = "bar-fill " + (hw.passed ? "ok" : hwPercent >= (hw.target || 95) * 0.7 ? "warn" : "err");

  const ktp = criteria.ktp || {};
  const ktpPercent = num(ktp.percent);
  critKtpVal.textContent = ktpPercent.toFixed(1) + "%";
  critKtpMeta.textContent = `${ktp.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, ktp.target || 95, ktp.done || 0)}`;
  barKtp.style.width = Math.min(100, ktpPercent) + "%";
  barKtp.className = "bar-fill " + (ktp.passed ? "ok" : ktpPercent >= (ktp.target || 95) * 0.7 ? "warn" : "err");

  const lch = criteria.launch || {};
  const lchPercent = num(lch.percent);
  critLaunchVal.textContent = lchPercent.toFixed(1) + "%";
  critLaunchMeta.textContent = `${lch.done || 0} / ${criteria.total_lessons} · до цели: ${neededToTarget(criteria.total_lessons, lch.target || 30, lch.done || 0)}`;
  barLaunch.style.width = Math.min(100, lchPercent) + "%";
  barLaunch.className = "bar-fill " + (lch.passed ? "ok" : lchPercent >= (lch.target || 30) * 0.7 ? "warn" : "err");
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmt(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

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
  } finally {
    refreshing = false;
  }
}

document.getElementById("refreshTokenBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshTokenBtn");
  btn.disabled = true; btn.textContent = "Получаю...";
  const r = await sendMsg({ type: "refreshToken" });
  btn.disabled = false; btn.textContent = "Обновить токен";
  toast(r?.success ? "Токен получен" : "Ошибка: " + (r?.error || ""), r?.success ? "ok" : "err");
  await renderAll();
});

document.getElementById("refreshAllBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshAllBtn");
  btn.disabled = true; btn.textContent = "Обновляю...";
  await renderAll();
  btn.disabled = false; btn.textContent = "Обновить данные";
  toast("Данные обновлены", "ok");
});

(async function init() {
  await renderCriteria();
  await renderTab("homework");
  setInterval(renderCriteria, 5000);
})();