// tabs/homework.js — календарь ДЗ из квадратиков (как в Next.js)

const LESSON_DURATION_MIN = 45;   // длительность урока
const WINDOW_THRESHOLD_MIN = 20;  // разрыв между уроками ≥ 20 мин → окно

export function renderHomeworkCalendar(container, state, { onOpenLesson, onBulkEmpty }) {
  const schedule = state.schedule || [];
  const period = state.period;
  const today = new Date().toISOString().slice(0, 10);

  container.innerHTML = "";

  // ===== Bulk-row =====
  const bulk = document.createElement("div");
  bulk.className = "bulk-row";

  const bulkBtn = document.createElement("button");
  bulkBtn.className = "btn btn-primary";
  bulkBtn.textContent = "Заполнить все без ДЗ";
  bulkBtn.onclick = onBulkEmpty;
  bulk.appendChild(bulkBtn);

  const futureMissing = schedule.filter(
    (l) => l.date >= today && !l.has_homework
  ).length;

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML = `без ДЗ: <b>${futureMissing}</b> · период: <b>${period ? fmtDate(period.from) + " — " + fmtDate(period.to) : "—"}</b>`;
  bulk.appendChild(hint);
  container.appendChild(bulk);

  // ===== Легенда =====
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = `
    <div class="legend-item"><div class="legend-box green"></div> ДЗ задано</div>
    <div class="legend-item"><div class="legend-box red"></div> пропущено</div>
    <div class="legend-item"><div class="legend-box yellow"></div> не задано</div>
    <div class="legend-item"><div class="legend-box window"></div> окно учителя</div>
  `;
  container.appendChild(legend);

  if (!schedule.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Нет уроков. Нажмите «Обновить данные».";
    container.appendChild(empty);
    return;
  }

  // ===== Группируем по периодам 16→15 =====
  const periods = groupByReportPeriods(schedule);

  for (const p of periods) {
    const block = document.createElement("div");
    block.className = "period-block" + (p.to < today ? " past" : "");
    const isCurrent = p.from <= today && p.to >= today;

    const head = document.createElement("div");
    head.className = "period-head";

    const total = p.lessons.length;
    const withHw = p.lessons.filter((l) => l.has_homework).length;
    const futureWithout = p.lessons.filter((l) => l.date >= today && !l.has_homework).length;

    head.innerHTML = `
      <div style="display:flex; align-items:baseline; gap:10px;">
        <span class="period-title ${isCurrent ? "current" : ""}">${fmtDate(p.from)} — ${fmtDate(p.to)}</span>
        ${isCurrent ? '<span class="period-tag">текущий</span>' : ""}
      </div>
      <div class="period-stats">
        <span>уроков: <b>${total}</b></span>
        <span class="ok">с ДЗ: <b>${withHw}</b></span>
        ${futureWithout > 0 ? `<span class="warn">без ДЗ (будущие): <b>${futureWithout}</b></span>` : ""}
      </div>
    `;
    block.appendChild(head);

    // ===== Группируем по неделям =====
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

        // ===== Сортируем уроки дня по времени =====
        const sorted = [...day.lessons].sort((a, b) =>
          (a.time || "").localeCompare(b.time || "")
        );

        for (let i = 0; i < sorted.length; i++) {
          const lesson = sorted[i];

          // --- квадратик урока ---
          const sq = document.createElement("div");
          sq.className = "square";
          const isPast = lesson.date < today;

          if (lesson.has_homework) sq.classList.add("has");
          else if (isPast) sq.classList.add("missing-past");
          else sq.classList.add("missing-future");

          sq.title = `${lesson.time || ""} · ${lesson.groupName || ""} · ${lesson.lessonName || lesson.subjectName || ""}\n${lesson.has_homework ? "ДЗ задано" : "ДЗ не задано"}`;

          sq.onclick = () => onOpenLesson({
            id: lesson.id,
            date: lesson.date,
            time: lesson.time,
            groupName: lesson.groupName,
            title: lesson.lessonName || lesson.subjectName,
            lessonName: lesson.lessonName,
            has_homework: lesson.has_homework
          });

          squares.appendChild(sq);

          // --- проверяем разрыв до следующего урока ---
          const next = sorted[i + 1];
          if (!next) continue;

          const gap = gapMinutes(lesson.time, next.time);
          if (gap >= WINDOW_THRESHOLD_MIN) {
            const win = document.createElement("div");
            win.className = "square window";
            win.title = `Окно учителя · ${gap} мин (${lesson.time}–${next.time})`;
            squares.appendChild(win);
          }
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
// Утилиты
// ============================================================

/** Разрыв между уроками в минутах: конец первого + длительность до начала второго */
function gapMinutes(prevTime, nextTime) {
  const prevEnd = toMin(prevTime) + LESSON_DURATION_MIN;
  const nextStart = toMin(nextTime);
  return nextStart - prevEnd;
}

function toMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

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