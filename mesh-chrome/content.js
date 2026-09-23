// content.js
(async function () {
  "use strict";

  function findToken() {
    const keys = [
      "access_token",
      "token",
      "auth_token",
      "id_token",
      "jwt",
      "mes_token",
    ];

    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.length > 20) return { token: v, source: "localStorage." + k };
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (v && v.startsWith("eyJ") && v.length > 50) {
        return { token: v, source: "localStorage." + k };
      }
    }

    for (const k of keys) {
      const v = sessionStorage.getItem(k);
      if (v && v.length > 20)
        return { token: v, source: "sessionStorage." + k };
    }

    for (const c of document.cookie.split(";")) {
      const [name, ...rest] = c.trim().split("=");
      const value = rest.join("=");
      if (keys.includes(name.trim()) && value && value.length > 20) {
        return { token: value, source: "cookie." + name.trim() };
      }
      if (value.startsWith("eyJ") && value.length > 50) {
        return { token: value, source: "cookie." + name.trim() };
      }
    }

    return null;
  }

  try {
    const found = findToken();
    if (found)
      return { success: true, token: found.token, source: found.source };
    return { success: false, error: "Токен не найден" };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();