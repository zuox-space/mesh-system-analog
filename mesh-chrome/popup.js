// popup.js
const API_BASE = "http://localhost:3000";

// DOM
const linkScreen = document.getElementById("linkScreen");
const mainScreen = document.getElementById("mainScreen");
const pairCodeInput = document.getElementById("pairCodeInput");
const linkBtn = document.getElementById("linkBtn");
const statusCard = document.getElementById("statusCard");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const userCard = document.getElementById("userCard");
const userName = document.getElementById("userName");
const userMeta = document.getElementById("userMeta");
const avatar = document.getElementById("avatar");
const tokenInfoCard = document.getElementById("tokenInfoCard");
const tokenExpires = document.getElementById("tokenExpires");
const tokenRemaining = document.getElementById("tokenRemaining");
const progressFill = document.getElementById("progressFill");
const grantBtn = document.getElementById("grantBtn");
const refreshBtn = document.getElementById("refreshBtn");
const unlinkBtn = document.getElementById("unlinkBtn");

let extensionToken = null;
let meshToken = null;

// ---------- storage ----------

async function getExtToken() {
  const { extToken } = await chrome.storage.local.get("extToken");
  return extToken || null;
}

async function setExtToken(v) {
  await chrome.storage.local.set({ extToken: v });
}

async function clearExtToken() {
  await chrome.storage.local.remove("extToken");
}

// ---------- UI ----------

function setStatus(text, type = "info") {
  statusCard.className = "card " + type;
  statusCard.innerHTML = `
    <div class="card-row">
      ${type === "info" ? '<div class="spinner"></div>' : ""}
      <span>${text}</span>
    </div>`;
  statusDot.className =
    "status-dot " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
}

function initials(first, last) {
  const a = (first || "").trim().charAt(0);
  const b = (last || "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function showUser(user) {
  if (!user) {
    userCard.style.display = "none";
    return;
  }
  const parts = [user.lastName, user.firstName, user.middleName].filter(Boolean);
  userName.textContent =
    parts.join(" ") || user.email || user.sub || "Пользователь";
  userMeta.textContent = user.email || user.sub || "";
  avatar.textContent = initials(user.firstName, user.lastName);
  userCard.style.display = "flex";
}

function showTokenInfo(expiresAt) {
  if (!expiresAt) {
    tokenInfoCard.style.display = "none";
    return;
  }
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) {
    tokenInfoCard.style.display = "none";
    return;
  }

  const now = new Date();
  const totalMin = Math.round((exp.getTime() - now.getTime()) / 60000);
  const HOURS_24 = 24 * 60;
  const pct = Math.min(100, Math.max(0, (totalMin / HOURS_24) * 100));

  tokenExpires.textContent = exp.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (totalMin <= 0) {
    tokenRemaining.textContent = "Истёк";
    progressFill.style.width = "0%";
    progressFill.style.background = "linear-gradient(90deg, #F87171, #DC2626)";
  } else if (totalMin < 60) {
    tokenRemaining.textContent = `${totalMin} мин. осталось`;
    progressFill.style.width = pct + "%";
    progressFill.style.background = "linear-gradient(90deg, #FBBF24, #F59E0B)";
  } else if (totalMin < 60 * 24) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    tokenRemaining.textContent = `~${h} ч ${m} мин. осталось`;
    progressFill.style.width = pct + "%";
    progressFill.style.background = "linear-gradient(90deg, #4A9EFF, #7B61FF)";
  } else {
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    tokenRemaining.textContent = `~${days} дн. ${hours} ч осталось`;
    progressFill.style.width = "100%";
    progressFill.style.background = "linear-gradient(90deg, #4A9EFF, #7B61FF)";
  }
  tokenInfoCard.style.display = "block";
}

// ---------- Получение токена со страницы ----------

async function grabMeshToken() {
  // Ищем вкладку school.mos.ru среди всех открытых
  const tabs = await chrome.tabs.query({ url: "https://school.mos.ru/*" });

  if (!tabs.length) {
    return {
      success: false,
      error: "Откройте school.mos.ru в отдельной вкладке и авторизуйтесь",
    };
  }

  const tab = tabs[0];
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });

  return (
    results[0]?.result || { success: false, error: "Нет ответа от страницы" }
  );
}

// ---------- Сеть ----------

async function apiLink(code) {
  const r = await fetch(`${API_BASE}/api/extension/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

async function apiMe(extToken) {
  const r = await fetch(`${API_BASE}/api/extension/me`, {
    headers: { "X-Extension-Token": extToken },
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

async function apiStatus(extToken) {
  const r = await fetch(`${API_BASE}/api/tokens/status`, {
    headers: { "X-Extension-Token": extToken },
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

async function apiSendMeshToken(extToken, meshToken) {
  const r = await fetch(`${API_BASE}/api/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Extension-Token": extToken,
    },
    body: JSON.stringify({ token: meshToken }),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

// ---------- Экраны ----------

function showLinkScreen() {
  linkScreen.style.display = "block";
  mainScreen.style.display = "none";
  pairCodeInput.value = "";
  pairCodeInput.focus();
}

function showMainScreen() {
  linkScreen.style.display = "none";
  mainScreen.style.display = "block";
}

// ---------- Привязка ----------

linkBtn.addEventListener("click", async () => {
  const code = pairCodeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    alert("Код должен состоять из 6 цифр");
    return;
  }
  linkBtn.disabled = true;
  linkBtn.textContent = "Связываю...";

  const { ok, data } = await apiLink(code);
  linkBtn.disabled = false;
  linkBtn.textContent = "Связать";

  if (!ok) {
    alert("Ошибка: " + (data.detail || "неизвестно"));
    return;
  }

  await setExtToken(data.extensionToken);
  extensionToken = data.extensionToken;
  showMainScreen();
  await initMain();
});

// ---------- Основная логика ----------

async function initMain() {
  setStatus("Проверяю токен...", "info");
  grantBtn.style.display = "none";
  refreshBtn.style.display = "none";
  userCard.style.display = "none";
  tokenInfoCard.style.display = "none";

  if (!extensionToken) {
    showLinkScreen();
    return;
  }

  const meRes = await apiMe(extensionToken);
  if (!meRes.ok) {
    await clearExtToken();
    showLinkScreen();
    return;
  }

  showUser(meRes.data.user);

  grantBtn.style.display = "block";
  refreshBtn.style.display = "block";

  const statusRes = await apiStatus(extensionToken);
  if (!statusRes.ok) {
    setStatus("Ошибка статуса: " + (statusRes.data.detail || ""), "err");
    grantBtn.textContent = "Разрешить доступ к МЭШ";
    return;
  }

  const st = statusRes.data;

  if (st.has_token && st.is_valid) {
    setStatus("Доступ активен. Токен МЭШ валиден.", "ok");
    showTokenInfo(st.expires_at);
    grantBtn.textContent = "Обновить токен МЭШ";
    return;
  }

  if (st.has_token && !st.is_valid) {
    setStatus("Токен МЭШ истёк. Нажмите «Обновить токен МЭШ».", "err");
    grantBtn.textContent = "Перепривязать токен МЭШ";
    return;
  }

  setStatus("Токен МЭШ не предоставлен.", "info");
  grantBtn.textContent = "Разрешить доступ к МЭШ";
}

async function grantMeshAccess() {
  if (!extensionToken) {
    showLinkScreen();
    setStatus("Токен МЭШ сохранён.", "ok");
    showUser(send.data.user);
    showTokenInfo(send.data.expiresAt);
    grantBtn.textContent = "Обновить токен МЭШ";

    // Уведомляем background, чтобы он сразу проверил срок
    chrome.runtime.sendMessage({ type: "tokenUpdated" }).catch(() => { });
    return;
  }

  setStatus("Ищу вкладку school.mos.ru...", "info");
  grantBtn.disabled = true;

  const pageResult = await grabMeshToken();
  if (!pageResult.success || !pageResult.token) {
    setStatus(pageResult.error || "Токен МЭШ не найден на странице", "err");
    grantBtn.disabled = false;
    return;
  }

  meshToken = pageResult.token;
  console.log("Token source:", pageResult.source);

  setStatus("Отправляю токен на сервер...", "info");
  const send = await apiSendMeshToken(extensionToken, meshToken);
  grantBtn.disabled = false;

  if (!send.ok) {
    setStatus("Ошибка отправки: " + (send.data.detail || ""), "err");
    return;
  }

  setStatus("Токен МЭШ сохранён.", "ok");
  showUser(send.data.user);
  showTokenInfo(send.data.expiresAt);
  grantBtn.textContent = "Обновить токен МЭШ";
}

// ---------- Обработчики ----------

grantBtn.addEventListener("click", grantMeshAccess);
refreshBtn.addEventListener("click", initMain);

unlinkBtn.addEventListener("click", async () => {
  if (!confirm("Отвязать расширение? Придётся вводить новый код.")) return;
  await clearExtToken();
  extensionToken = null;
  showLinkScreen();
});

// ---------- Старт ----------

(async () => {
  extensionToken = await getExtToken();
  if (extensionToken) {
    showMainScreen();
    await initMain();
  } else {
    showLinkScreen();
  }
})();