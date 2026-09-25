// tabs/lessons.js — календарь уроков (как LaunchView.tsx)

export function renderLessonsCalendar(container, state, onLaunchNow) {
  const schedule = state.schedule || [];
  const today = new Date().toISOString().slice(0, 10);

  container.innerHTML = "";

  // Легенда
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = `
    <div class="legend-item"><div class="legend-box green"></div> запущен</div>
    <div class="legend-item"><div class="legend-box blue"></div> идёт сейчас</div>
    <div class="legend-item"><div class="legend-box red"></div> не запущен / ошибка</div>
    <div class="legend-item"><div class="legend-box yellow"></div> ожидает</div>
    <div class="legend-item"><div class="legend-box gray"></div> нет ссылки на запуск</div>
  `;
  container.appendChild(legend);

  if (!schedule.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Нет уроков. Нажмите «Обновить данные».";
    container.appendChild(empty);
    return;
  }

  const periods = groupByReportPeriods(schedule);

  for (const p of periods) {
    const block = document.createElement("div");
    block.className = "period-block" + (p.to < today ? " past" : "");
    const isCurrent = p.from <= today && p.to >= today;

    const total = p.lessons.length;
    const running = p.lessons.filter((l) => l.status === "running").length;
    const finished = p.lessons.filter((l) => l.status === "finished" || l.is_launched).length;
    const failed = p.lessons.filter((l) => l.status === "failed").length;
    const noUrl = p.lessons.filter((l) => !canLaunch(l)).length;

    const head = document.createElement("div");
    head.className = "period-head";
    head.innerHTML = `
      <div style="display:flex; align-items:baseline; gap:10px;">
        <span class="period-title ${isCurrent ? "current" : ""}">${fmtDate(p.from)} — ${fmtDate(p.to)}</span>
        ${isCurrent ? '<span class="period-tag">текущий</span>' : ""}
      </div>
      <div class="period-stats">
        <span class="ok">✓ <b>${finished}</b></span>
        ${running > 0 ? `<span style="color:#4A9EFF">⚙ <b>${running}</b></span>` : ""}
        ${failed > 0 ? `<span style="color:#F87171">✕ <b>${failed}</b></span>` : ""}
        ${noUrl > 0 ? `<span style="color:#64748B">— <b>${noUrl}</b></span>` : ""}
        <span>всего: <b>${total}</b></span>
      </div>
    `;
    block.appendChild(head);

    const weeks = groupByWeeks(p.lessons);
    const weeksRow = document.createElement("div");
    weeksRow.className = "weeks-row";

    for (const w of weeks) {
      const col = document.createElement("div");
      col.className = "week-col";

      const wLabel = document.createElement("div");
      wLabel.className = "week-label";
      wLabel.textContent = w.label;
      col.appendChild(wLabel);

      for (const day of w.days) {
        const row = document.createElement("div");
        row.className = "day-row";
        if (day.date === today) row.classList.add("today");
        if (day.date < today) row.classList.add("past");

        const dateDiv = document.createElement("div");
        dateDiv.className = "day-date";
        dateDiv.innerHTML = `
          <span class="day-day">${fmtDate(day.date)}</span>
          <span class="day-weekday">${weekday(day.date)}</span>
        `;
        row.appendChild(dateDiv);

        const squares = document.createElement("div");
        squares.className = "squares";

        for (const lesson of day.lessons) {
          const sq = document.createElement("div");
          sq.className = "square";

          const canLaunchLesson = canLaunch(lesson);

          // ===== Приоритеты цветов =====
          if (!canLaunchLesson) {
            // нет ссылки — всегда серый, независимо от статуса
            sq.classList.add("no-url");
          } else if (lesson.status === "finished" || lesson.is_launched) {
            sq.classList.add("has");
          } else if (lesson.status === "running") {
            sq.classList.add("running");
          } else if (lesson.status === "failed") {
            sq.classList.add("failed");
          } else if (lesson.date < today) {
            sq.classList.add("missing-past");
          } else {
            sq.classList.add("missing-future");
          }

          sq.title = buildTooltip(lesson, canLaunchLesson);

          if (canLaunchLesson) {
            sq.onclick = () => onLaunchNow(lesson.id);
          } else {
            sq.style.cursor = "not-allowed";
          }

          squares.appendChild(sq);
        }
        row.appendChild(squares);
        col.appendChild(row);
      }
      weeksRow.appendChild(col);
    }
    block.appendChild(weeksRow);
    container.appendChild(block);
  }
}

// ============================================================
// Можно ли запустить урок
// ============================================================
function canLaunch(lesson) {
  return !!(lesson.launchUrl || lesson.scriptUuid);
}

function buildTooltip(lesson, canLaunchLesson) {
  const title = lesson.lessonName || lesson.subjectName || "Урок";
  const meta = `${lesson.time || ""} · ${lesson.groupName || ""}`;
  let status;

  if (!canLaunchLesson) {
    status = "❌ нет ссылки на запуск (нет прикреплённого материала)";
  } else if (lesson.status === "finished" || lesson.is_launched) {
    status = "✓ проведён";
  } else if (lesson.status === "running") {
    status = "⚙ идёт сейчас";
  } else if (lesson.status === "failed") {
    status = "✕ ошибка: " + (lesson.errorMessage || "");
  } else if (lesson.date < new Date().toISOString().slice(0, 10)) {
    status = "⚠ не запущен";
  } else {
    status = "⏳ ожидает запуска";
  }

  return `${title}\n${meta}\n${status}`;
}

// ============================================================
// Утилиты группировки
// ============================================================
function groupByReportPeriods(lessons) {
  const byDate = new Map();
  for (const l of lessons) {
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date).push(l);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return [];

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
      if (date >= fromIso && date <= toIso) periodLessons.push(...byDate.get(date));
    }
    if (periodLessons.length > 0) {
      periods.push({ from: fromIso, to: toIso, lessons: periodLessons });
    }

    cur = new Date(to);
    cur.setDate(cur.getDate() + 1);
  }
  return periods;
}

function groupByWeeks(lessons) {
  const byDate = new Map();
  for (const l of lessons) {
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date).push(l);
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
      weeks.push(makeWeek(currentWeek, lastMonday));
      currentWeek = [];
    }
    lastMonday = mondayIso;
    currentWeek.push({ date, lessons: byDate.get(date) || [] });
  }
  if (currentWeek.length) weeks.push(makeWeek(currentWeek, lastMonday));
  return weeks;
}

function makeWeek(days, mondayIso) {
  const monday = parseDate(mondayIso);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    label: `${fmtDate(isoOf(monday))} — ${fmtDate(isoOf(sunday))}`,
    days
  };
}

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}
function weekday(iso) {
  const d = parseDate(iso);
  return d.toLocaleDateString("ru-RU", { weekday: "short" });
}