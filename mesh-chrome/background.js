// background.js
const API_BASE = "http://localhost:3000";
const CHECK_INTERVAL_MINUTES = 60;      // проверять раз в час
const WARN_THRESHOLD_MINUTES = 120;     // предупреждать, если осталось < 2 часов
const ALARM_NAME = "checkTokenExpiry";
const NOTIFICATION_ID = "mesh-token-expiring";

// ---------- Установка / обновление расширения ----------

chrome.runtime.onInstalled.addListener(() => {
    console.log("[bg] installed/updated, setting up alarm");
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_INTERVAL_MINUTES,
        delayInMinutes: 1,        // первая проверка через минуту
    });
});

chrome.runtime.onStartup.addListener(() => {
    console.log("[bg] browser started, ensuring alarm exists");
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_INTERVAL_MINUTES,
        delayInMinutes: 1,
    });
});

// ---------- Обработчик будильника ----------

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    console.log("[bg] alarm fired, checking token");
    await checkToken();
});

// ---------- Основная проверка ----------

async function checkToken() {
    const { extToken } = await chrome.storage.local.get("extToken");
    if (!extToken) {
        console.log("[bg] no extToken, skip");
        return;
    }

    try {
        const r = await fetch(`${API_BASE}/api/tokens/status`, {
            headers: { "X-Extension-Token": extToken },
        });

        if (!r.ok) {
            console.log("[bg] status failed:", r.status);
            return;
        }

        const st = await r.json();

        // Нет токена МЭШ — нечего проверять
        if (!st.has_token || !st.expires_at) {
            console.log("[bg] no mesh token, skip");
            return;
        }

        const exp = new Date(st.expires_at);
        const now = new Date();
        const minutesLeft = Math.round((exp.getTime() - now.getTime()) / 60000);

        console.log(`[bg] token expires in ${minutesLeft} min`);

        // Токен уже истёк
        if (minutesLeft <= 0) {
            showNotification(
                "Токен МЭШ истёк",
                "Откройте расширение и нажмите «Перепривязать токен МЭШ».",
                "expired"
            );
            return;
        }

        // Скоро истечёт
        if (minutesLeft <= WARN_THRESHOLD_MINUTES) {
            const hours = Math.floor(minutesLeft / 60);
            const mins = minutesLeft % 60;
            const timeStr =
                hours > 0 ? `${hours} ч ${mins} мин` : `${mins} мин`;

            showNotification(
                "Токен МЭШ скоро истечёт",
                `Осталось ${timeStr}. Откройте school.mos.ru и зайдите в дневник, затем обновите токен в расширении.`,
                "expiring"
            );
            return;
        }

        // Токен в порядке — можно очистить старые уведомления
        chrome.notifications.clear(NOTIFICATION_ID);
    } catch (e) {
        console.error("[bg] checkToken error:", e);
    }
}

// ---------- Уведомления ----------

function showNotification(title, message, tag) {
    chrome.notifications.create(NOTIFICATION_ID, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message,
        priority: 2,
        requireInteraction: tag === "expired",  // не закрывать автоматически для "истёк"
    });
}

// ---------- Клик по уведомлению — открыть popup ----------

chrome.notifications.onClicked.addListener((id) => {
    if (id === NOTIFICATION_ID) {
        // Открываем popup — в MV3 нельзя открыть программно,
        // но можно открыть school.mos.ru, чтобы пользователь освежил сессию
        chrome.tabs.create({ url: "https://school.mos.ru" });
        chrome.notifications.clear(id);
    }
});

// ---------- Слушаем изменения extToken ----------

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.extToken) {
        console.log("[bg] extToken changed, running immediate check");
        checkToken();
    }
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "tokenUpdated") {
        console.log("[bg] token updated, immediate check");
        checkToken().then(() => sendResponse({ ok: true }));
        return true;  // асинхронный ответ
    }
});