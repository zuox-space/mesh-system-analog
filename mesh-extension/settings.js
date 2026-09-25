// settings.js

const $ = (id) => document.getElementById(id);

const autoLaunch = $("autoLaunch");
const autoKtpUpdate = $("autoKtpUpdate");
const catchUpMinutes = $("catchUpMinutes");
const warnMinutes = $("warnMinutes");
const lastKtp = $("lastKtp");
const resetBtn = $("resetBtn");
const closeBtn = $("closeBtn");
const saveStatus = $("saveStatus");

// ============================================================
// Загрузка текущих настроек
// ============================================================
async function loadSettings() {
    const { settings, lastKtpUpdateAt } = await chrome.storage.local.get(["settings", "lastKtpUpdateAt"]);

    const s = settings || {};

    autoLaunch.checked = s.autoLaunch !== false;
    autoKtpUpdate.checked = !!s.autoKtpUpdate;
    catchUpMinutes.value = s.catchUpMinutes ?? 60;
    warnMinutes.value = s.warnMinutes ?? 120;

    lastKtp.textContent = lastKtpUpdateAt ? timeAgo(lastKtpUpdateAt) : "никогда";
}

// ============================================================
// Сохранение
// ============================================================
async function saveSettings() {
    const patch = {
        autoLaunch: autoLaunch.checked,
        autoKtpUpdate: autoKtpUpdate.checked,
        catchUpMinutes: clampInt(catchUpMinutes.value, 0, 180, 60),
        warnMinutes: clampInt(warnMinutes.value, 10, 600, 120)
    };

    // Обновляем через background, чтобы гарантировать merge с DEFAULTS
    try {
        await chrome.runtime.sendMessage({ type: "updateSettings", settings: patch });
    } catch (e) {
        console.warn("updateSettings failed, fallback to storage.local.set:", e);
        const { settings } = await chrome.storage.local.get("settings");
        await chrome.storage.local.set({ settings: { ...(settings || {}), ...patch } });
    }

    showSaved();
}

function clampInt(v, min, max, def) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
}

let savedTimer = null;
function showSaved() {
    saveStatus.textContent = "Сохранено";
    saveStatus.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => saveStatus.classList.remove("show"), 1500);
}

// ============================================================
// Обработчики
// ============================================================
autoLaunch.addEventListener("change", saveSettings);
autoKtpUpdate.addEventListener("change", saveSettings);
catchUpMinutes.addEventListener("change", saveSettings);
warnMinutes.addEventListener("change", saveSettings);

resetBtn.addEventListener("click", async () => {
    if (!confirm("Сбросить все настройки к значениям по умолчанию?")) return;
    autoLaunch.checked = true;
    autoKtpUpdate.checked = false;
    catchUpMinutes.value = 60;
    warnMinutes.value = 120;
    await saveSettings();
});

closeBtn.addEventListener("click", () => {
    window.close();
});

// ============================================================
// Подписка — если настройки изменились из другого места
// ============================================================
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) loadSettings();
    if (changes.lastKtpUpdateAt) {
        lastKtp.textContent = changes.lastKtpUpdateAt.newValue
            ? timeAgo(changes.lastKtpUpdateAt.newValue)
            : "никогда";
    }
});

// ============================================================
// Утилиты
// ============================================================
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

// Обновляем "N мин назад" каждые 30 сек
setInterval(() => {
    chrome.storage.local.get("lastKtpUpdateAt").then(({ lastKtpUpdateAt }) => {
        lastKtp.textContent = lastKtpUpdateAt ? timeAgo(lastKtpUpdateAt) : "никогда";
    });
}, 30000);

// ============================================================
// Старт
// ============================================================
loadSettings();