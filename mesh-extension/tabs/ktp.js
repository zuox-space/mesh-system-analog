// tabs/ktp.js — карточки групп КТП

export function renderKtp(container, state, { onUpdateAll }) {
  const items = state.ktp || [];
  container.innerHTML = "";

  const bulk = document.createElement("div");
  bulk.className = "bulk-row";
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Обновить все КТП";
  btn.onclick = onUpdateAll;
  bulk.appendChild(btn);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML = `групп: <b>${items.length}</b>`;
  bulk.appendChild(hint);
  container.appendChild(bulk);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Нет данных. Нажмите «Обновить данные».";
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "ktp-grid";

  for (const k of items) {
    const card = document.createElement("div");
    let cls = "ktp-card";
    if (k.done) cls += " ok";
    else if (k.hasIssues) cls += " warn";
    card.className = cls;
    card.innerHTML = `
      <div class="ktp-name">${esc(k.groupName)}</div>
      <div class="ktp-stats">
        <span>тем: <b>${k.total}</b></span>
        <span class="emerald">с датой: <b>${k.withDate}</b></span>
        <span class="amber">без даты: <b>${k.withoutDate}</b></span>
      </div>
    `;
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}