// tabs/ktp.js
export function renderKtp(container, state, { onUpdateAll, onUpdateOne }) {
  const items = Array.isArray(state.ktp) ? state.ktp : [];
  container.innerHTML = "";

  // ===== Bulk-кнопка =====
  const bulk = document.createElement("div");
  bulk.className = "ktp-bulk-row";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Обновить все КТП";
  btn.onclick = () => {
    const noPlan = items.filter((k) => !k.hasPlan || !k.id);
    let msg = "Обновить все КТП? Может занять 10–30 сек.";
    if (noPlan.length > 0) {
      msg = `Обновить все КТП?\n\n⚠️ Для ${noPlan.length} групп(ы) нет плана в МЭШ — они не будут обновлены:\n` +
        noPlan.slice(0, 5).map((k) => " • " + (k.groupName || k.groupId)).join("\n") +
        (noPlan.length > 5 ? `\n … и ещё ${noPlan.length - 5}` : "");
    }
    if (!confirm(msg)) return;
    onUpdateAll?.();
  };
  bulk.appendChild(btn);

  const hint = document.createElement("div");
  hint.className = "ktp-bulk-hint";
  const noPlanCount = items.filter((k) => !k.hasPlan || !k.id).length;
  const doneCount = items.filter((k) => k.done).length;
  hint.innerHTML = `групп: <b>${items.length}</b> · привязано: <b>${doneCount}</b>` +
    (noPlanCount > 0 ? ` · <span style="color:#F87171">без плана: <b>${noPlanCount}</b></span>` : "");
  bulk.appendChild(hint);

  container.appendChild(bulk);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "ktp-empty";
    empty.textContent = "Нет данных. Нажмите «Обновить данные».";
    container.appendChild(empty);
    return;
  }

  // ===== Плашка про группы без плана =====
  if (noPlanCount > 0) {
    const warn = document.createElement("div");
    warn.className = "ktp-warn-banner";
    warn.innerHTML = `
      <div class="ktp-warn-title">⚠️ ${noPlanCount} групп(ы) без плана в МЭШ</div>
      <div class="ktp-warn-text">Их нельзя обновить автоматически. Создайте план в МЭШ → Планирование.</div>`;
    container.appendChild(warn);
  }

  const okItems = items.filter((k) => k.done);
  const problemItems = items.filter((k) => !k.done);

  // ===== Успешные =====
  if (okItems.length) {
    const head = document.createElement("div");
    head.className = "ktp-section-head";
    head.innerHTML = `<span>✓ Привязано</span><span class="ktp-section-count">${okItems.length}</span>`;
    container.appendChild(head);

    const list = document.createElement("div");
    list.className = "ktp-grid-ok";

    for (const k of okItems) {
      const card = document.createElement("div");
      card.className = "ktp-ok-card";
      card.title = k.groupName || "";
      card.textContent = k.groupName || "Группа";
      list.appendChild(card);
    }
    container.appendChild(list);
  }

  // ===== Проблемные =====
  if (problemItems.length) {
    const head = document.createElement("div");
    head.className = "ktp-section-head";
    head.innerHTML = `<span>⚠️ Требуют внимания</span><span class="ktp-section-count">${problemItems.length}</span>`;
    container.appendChild(head);

    const list = document.createElement("div");
    list.className = "ktp-list-problem";

    for (const k of problemItems) {
      const hasPlan = !!(k.hasPlan && k.id);
      const card = document.createElement("div");
      card.className = "ktp-problem-card" + (hasPlan ? "" : " no-plan");

      const actionHtml = hasPlan
        ? `<button class="ktp-btn-update" data-plan-id="${k.id}">Обновить</button>`
        : `<span class="ktp-tag-no-plan">нет плана</span>`;

      card.innerHTML = `
        <div class="ktp-problem-head">
          <div class="ktp-problem-name" title="${esc(k.groupName || "")}">${esc(k.groupName || "Группа")}</div>
          ${actionHtml}
        </div>
        <div class="ktp-problem-stats">
          <div class="ktp-stat">
            <span class="ktp-stat-label">уроков</span>
            <span class="ktp-stat-value">${k.total || 0}</span>
          </div>
          <div class="ktp-stat">
            <span class="ktp-stat-label">привязано</span>
            <span class="ktp-stat-value ok">${k.withDate || 0}</span>
          </div>
          <div class="ktp-stat">
            <span class="ktp-stat-label">без темы</span>
            <span class="ktp-stat-value warn">${k.withoutDate || 0}</span>
          </div>
        </div>
        ${hasPlan ? "" : `<div class="ktp-problem-hint">Создайте план в МЭШ → Планирование → для этого класса.</div>`}
      `;

      const b = card.querySelector("button");
      if (b) {
        b.addEventListener("click", () => onUpdateOne?.(Number(b.dataset.planId)));
      }

      list.appendChild(card);
    }
    container.appendChild(list);
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}