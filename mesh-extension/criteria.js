// criteria.js — расчёт критериев за отчётный период (16 → 15)

export function getReportPeriod(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();

  let from, to;
  if (day >= 16) {
    from = new Date(y, m, 16);
    to = new Date(y, m + 1, 15);
  } else {
    from = new Date(y, m - 1, 16);
    to = new Date(y, m, 15);
  }
  return { from: isoOf(from), to: isoOf(to) };
}

export function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoToday() { return isoOf(new Date()); }

export function calcCriteria(lessons, today = isoToday()) {
  const safe = Array.isArray(lessons) ? lessons : [];
  const total = safe.length;
  const pastLessons = safe.filter((l) => l.date < today);
  const futureLessons = safe.filter((l) => l.date >= today);

  function calc(key, target) {
    const done = safe.filter((l) => l[key]).length;
    const futurePossible = futureLessons.filter((l) => !l[key]).length;
    const maxPossible = done + futurePossible;
    const percent = total ? (done / total) * 100 : 0;
    const maxPercent = total ? (maxPossible / total) * 100 : 0;
    return {
      done,
      missing: total - done,
      percent: round1(percent),
      max_percent: round1(maxPercent),
      target,
      passed: percent >= target,
      reachable: maxPercent >= target
    };
  }

  const ktp = calc("has_ktp", 95);
  const hw = calc("has_homework", 95);
  const launch = calc("is_launched", 30);

return {
  total_lessons: total,
  total_past: pastLessons.length,
  total_future: futureLessons.length,
  ktp, hw, launch,
  overall_passed: ktp.passed && hw.passed && launch.passed,
  overall_reachable: ktp.reachable && hw.reachable && launch.reachable
};
}

function round1(x) { return Math.round(x * 10) / 10; }

export function neededToTarget(total, target, done) {
  const required = Math.ceil(total * (target / 100));
  return Math.max(0, required - done);
}