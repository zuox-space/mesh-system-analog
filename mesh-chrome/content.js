// content.js
(async function () {
  "use strict";

  function findToken() {
    // === 1. ГЛАВНОЕ: aupd_token в cookies — свежий токен МЭШ ===
    for (const c of document.cookie.split(";")) {
      const [name, ...rest] = c.trim().split("=");
      const value = rest.join("=");
      if (name.trim() === "aupd_token" && value && value.startsWith("eyJ")) {
        return { token: value, source: "cookie.aupd_token" };
      }
    }

    // === 2. Любая cookie с JWT длиной > 100 ===
    for (const c of document.cookie.split(";")) {
      const [name, ...rest] = c.trim().split("=");
      const value = rest.join("=");
      if (value && value.startsWith("eyJ") && value.length > 100) {
        return { token: value, source: "cookie." + name.trim() };
      }
    }

    // === 3. localStorage (fallback — может быть просрочен) ===
    const keys = [
      "saved_token",
      "authentication_token",
      "token",
      "auth_token",
      "access_token",
      "id_token",
      "jwt",
      "mes_token",
    ];

    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.startsWith("eyJ") && v.length > 50) {
        return { token: v, source: "localStorage." + k };
      }
    }

    // === 4. Любой JWT-подобный ключ ===
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (v && v.startsWith("eyJ") && v.length > 100) {
        return { token: v, source: "localStorage." + k };
      }
    }

    // === 5. sessionStorage ===
    for (const k of keys) {
      const v = sessionStorage.getItem(k);
      if (v && v.startsWith("eyJ") && v.length > 50) {
        return { token: v, source: "sessionStorage." + k };
      }
    }

    return null;
  }

  try {
    const found = findToken();
    if (found) return { success: true, token: found.token, source: found.source };
    return { success: false, error: "Токен не найден" };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();