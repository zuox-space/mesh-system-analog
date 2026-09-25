// background.js
import { getState, setState, updateCriteria } from "./storage.js";
import {
  fetchSession, findTeacherProfile, fetchUserInfo,
  fetchAcademicYear, fetchScheduleItems,
  fetchRooms, fetchStudents,
  fetchHomeworkPresence,
  fetchCalendarPlans, fetchCalendarPlan,
  resolveMaterialUuids, buildLaunchUrl,
  updateAllKtp, bulkSetEmptyHomework, createHomework
} from "./mesh-api.js";
import { calcCriteria, getReportPeriod } from "./criteria.js";

const ALARM_CHECK = "meshCheckSchedule";
const ALARM_QUICK = "meshCheckQuick";
const ALARM_TOKEN = "meshCheckToken";

// ============================================================
// Установка / запуск
// ============================================================
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[bg] installed");
  await chrome.alarms.create(ALARM_CHECK, { periodInMinutes: 1, delayInMinutes: 0.5 });
  await chrome.alarms.create(ALARM_QUICK, { periodInMinutes: 1, delayInMinutes: 0.2 });
  await chrome.alarms.create(ALARM_TOKEN, { periodInMinutes: 60, delayInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[bg] startup");
  await chrome.alarms.create(ALARM_CHECK, { periodInMinutes: 1, delayInMinutes: 0.5 });
  await chrome.alarms.create(ALARM_QUICK, { periodInMinutes: 1, delayInMinutes: 0.2 });
  await chrome.alarms.create(ALARM_TOKEN, { periodInMinutes: 60, delayInMinutes: 1 });

  // Сразу дёрнем tickSchedule, не дожидаясь alarm
  setTimeout(() => tickSchedule().catch(() => {}), 2000);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_CHECK || alarm.name === ALARM_QUICK) {
    await tickSchedule();
  }
  if (alarm.name === ALARM_TOKEN) await checkToken();
});

// ============================================================
// JWT
// ============================================================
function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    const raw = atob(padded);
    const json = decodeURIComponent(
      raw.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(json);
  } catch { return null; }
}

function getTokenExpiry(token) {
  const p = parseJwtPayload(token);
  if (!p) return null;
  for (const k of ["exp", "expires_at", "expiresAt"]) {
    const v = p[k];
    if (typeof v === "number") {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

// ============================================================
// Токен
// ============================================================
async function checkToken() {
  const { meshToken, meshTokenExpiresAt } = await getState(["meshToken", "meshTokenExpiresAt"]);
  if (!meshToken || !meshTokenExpiresAt) {
    await updateCriteria({ token: { valid: false, minutesLeft: 0 } });
    return;
  }
  const minutesLeft = Math.round((new Date(meshTokenExpiresAt).getTime() - Date.now()) / 60000);
  const valid = minutesLeft > 0;
  await updateCriteria({ token: { valid, minutesLeft } });
}

async function grabTokenFromTab() {
  const tabs = await chrome.tabs.query({ url: "https://school.mos.ru/*" });
  if (!tabs.length) return { success: false, error: "Откройте school.mos.ru" };
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        for (const c of document.cookie.split(";")) {
          const [name, ...rest] = c.trim().split("=");
          if (name.trim() === "aupd_token") {
            const value = rest.join("=");
            if (value.startsWith("eyJ")) return { success: true, token: value, source: "cookie.aupd_token" };
          }
        }
        return { success: false, error: "Токен не найден" };
      }
    });
  } catch (e) {
    return { success: false, error: "executeScript: " + e.message };
  }
  const r = results?.[0]?.result;
  if (r?.success && r.token) {
    const expiresAt = getTokenExpiry(r.token);
    await setState({ meshToken: r.token, meshTokenSource: r.source, meshTokenExpiresAt: expiresAt });
    await checkToken();
    await loadProfileAfterToken(r.token);
  }
  return r || { success: false, error: "Пустой ответ" };
}

async function loadProfileAfterToken(token) {
  try {
    const session = await fetchSession(token);
    const profile = findTeacherProfile(session);
    if (profile) await setState({ teacherId: Number(profile.id) });
    const info = await fetchUserInfo(token);
    if (info) {
      await setState({
        user: {
          sub: info.sub, firstName: info.given_name, lastName: info.family_name,
          middleName: info.middle_name, email: info.email
        }
      });
    }
    if (profile) {
      const year = await fetchAcademicYear(token, Number(profile.id));
      await setState({ academicYear: year });
    }
  } catch (e) { console.warn("[bg] loadProfileAfterToken failed:", e); }
}

// ============================================================
// tickSchedule — ретраи + не пробрасывает ошибку
// ============================================================
async function tickSchedule() {
  const { meshToken, teacherId, academicYear, settings } = await getState([
    "meshToken", "teacherId", "academicYear", "settings"
  ]);
  if (!meshToken || !teacherId || !academicYear) {
    console.log("[bg] tickSchedule skip: нет данных");
    return;
  }

  const period = getReportPeriod();

  try {
    let items = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        items = await fetchScheduleItems(
          meshToken, teacherId, academicYear.id, period.from, period.to
        );
        break;
      } catch (e) {
        console.warn(`[bg] fetchScheduleItems attempt ${attempt} failed:`, e.message);
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    if (!items) throw new Error("schedule items: пусто");

    let rooms = {};
    try {
      rooms = await fetchRooms(meshToken, teacherId);
    } catch (e) {
      console.warn("[bg] fetchRooms failed:", e.message);
    }

    const groupInfo = new Map();
    for (const l of items) {
      if (l.cancelled) continue;
      if (l.teacher_id && Number(l.teacher_id) !== teacherId) continue;
      const gid = Number(l.group_id);
      if (!gid || groupInfo.has(gid)) continue;
      groupInfo.set(gid, {
        groupId: gid,
        groupName: l.group_name || l.class_unit_name || "",
        classUnitId: l.class_unit_id ? Number(l.class_unit_id) : null,
        subjectId: Number(l.subject_id) || 0,
        subjectName: l.subject_name || ""
      });
    }

    const groups = [...groupInfo.values()];
    for (let i = 0; i < groups.length; i += 5) {
      const chunk = groups.slice(i, i + 5);
      await Promise.all(chunk.map(async (g) => {
        if (!g.classUnitId) { g.studentIds = []; return; }
        try {
          g.studentIds = await fetchStudents(
            meshToken, teacherId, academicYear.id, g.classUnitId, g.groupId
          );
        } catch { g.studentIds = []; }
      }));
    }
    const studentMap = new Map(groups.map((g) => [g.groupId, g.studentIds || []]));

    const lessonIds = items
      .filter((l) => !l.cancelled && (!l.teacher_id || Number(l.teacher_id) === teacherId))
      .map((l) => Number(l.id)).filter(Boolean);

    let presence = new Map();
    try {
      presence = await fetchHomeworkPresence(meshToken, teacherId, lessonIds);
    } catch (e) {
      console.warn("[bg] fetchHomeworkPresence failed:", e.message);
    }

    const { schedule: oldSchedule } = await getState(["schedule"]);
    const launchStatusMap = new Map(
      (oldSchedule || []).map((l) => [`${l.date}|${l.time}|${l.groupId}`, {
        status: l.status, is_launched: l.is_launched, startedAt: l.startedAt, late: l.late
      }])
    );

    const schedule = [];
    for (const l of items) {
      if (l.cancelled) continue;
      if (l.teacher_id && Number(l.teacher_id) !== teacherId) continue;
      const d = l.date;
      if (!Array.isArray(d)) continue;

      const dateIso = `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(d[2]).padStart(2, "0")}`;
      const t = l.time || [];
      const timeStr = Array.isArray(t) && t.length >= 2
        ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`
        : "";
      const gid = Number(l.group_id);
      const g = groupInfo.get(gid);
      const p = presence.get(Number(l.id));
      const hasHw = !!(p?.is_homework_exist || p?.is_homework_absences);
      const hasKtp = !!(l.topic_id || l.calendar_plan_id);
      const planKey = `${dateIso}|${timeStr}|${gid}`;
      const old = launchStatusMap.get(planKey);
      const isLaunched = old?.is_launched === true ||
                         old?.status === "running" ||
                         old?.status === "finished";

      let scriptUuid = null;
      if (Array.isArray(l.scripts_new) && l.scripts_new.length) {
        scriptUuid = l.scripts_new[0].uuid || null;
      }

      schedule.push({
        id: l.id,
        date: dateIso, time: timeStr,
        startAt: `${dateIso}T${timeStr}:00`,
        study_ordinal: l.study_ordinal,
        lessonName: l.lesson_name || "",
        groupId: gid, groupName: g?.groupName || "",
        subjectId: Number(l.subject_id) || 0,
        subjectName: l.subject_name || "",
        roomName: rooms[Number(l.room_id)] || l.room_name || "",
        studentIds: studentMap.get(gid) || [],
        has_homework: hasHw,
        has_ktp: hasKtp,
        is_launched: isLaunched,
        scriptUuid,
        launchUrl: old?.launchUrl || "",
        status: old?.status || "pending",
        startedAt: old?.startedAt || null,
        late: old?.late || false
      });
    }

    await setState({ schedule, period });
    await recalcCriteria();

    if (settings?.autoLaunch !== false) {
      try {
        await launchDueLessons(schedule, meshToken);
      } catch (e) {
        console.warn("[bg] launchDueLessons failed:", e.message);
      }
    }

    await setState({ lastCheck: new Date().toISOString() });
    console.log("[bg] tickSchedule OK:", schedule.length, "уроков");
  } catch (e) {
    console.error("[bg] tickSchedule error:", e.message || e);
  }
}

// ============================================================
// Автозапуск с «догоном» до 60 минут
// ============================================================
async function launchDueLessons(schedule, meshToken) {
  const { teacherId, settings } = await getState(["teacherId", "settings"]);
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);

  const CATCH_UP_MIN = settings?.catchUpMinutes ?? 60;

  let changed = false;

  for (const lesson of schedule) {
    if (lesson.status !== "pending") continue;
    if (lesson.date !== today) continue;

    const diffMin = (now - new Date(lesson.startAt)) / 60000;
    if (diffMin < -1 || diffMin > CATCH_UP_MIN) continue;

    const isLate = diffMin > 5;

    console.log(
      `[bg] launch${isLate ? " (late)" : ""}: ${lesson.date} ${lesson.time} ` +
      `${lesson.lessonName} (diffMin=${Math.round(diffMin)})`
    );

    try {
      if (!lesson.launchUrl && lesson.scriptUuid) {
        const m = await resolveMaterialUuids(meshToken, teacherId, [lesson.scriptUuid]);
        const res = m[lesson.scriptUuid];
        if (res?.original_uuid) {
          lesson.launchUrl = buildLaunchUrl(
            teacherId, res.original_uuid, lesson.subjectId, lesson.groupId
          );
        }
      }

      if (!lesson.launchUrl) {
        console.warn(`[bg] no launchUrl for ${lesson.id} (scriptUuid=${lesson.scriptUuid})`);
        lesson.status = "failed";
        lesson.errorMessage = "Нет launchUrl";
        changed = true;
        continue;
      }

      chrome.tabs.create({ url: lesson.launchUrl, active: false });

      lesson.status = "running";
      lesson.is_launched = true;
      lesson.startedAt = now.toISOString();
      if (isLate) lesson.late = true;

      changed = true;
      console.log(`[bg] launched${isLate ? " late" : ""}: ${lesson.launchUrl.slice(0, 80)}...`);
    } catch (e) {
      console.error(`[bg] launch error:`, e);
      lesson.status = "failed";
      lesson.errorMessage = String(e);
      changed = true;
    }
  }

  if (changed) {
    await setState({ schedule });
    await recalcCriteria();
  }
}

// ============================================================
// Критерии — не теряем token
// ============================================================
async function recalcCriteria() {
  const { schedule, criteria: oldCriteria } = await getState(["schedule", "criteria"]);
  const fresh = calcCriteria(schedule || []);
  const token = oldCriteria?.token || { valid: false, minutesLeft: 0 };
  await setState({ criteria: { ...fresh, token } });
  return { ...fresh, token };
}

// ============================================================
// Bulk: обновить все КТП — с авто-догоном
// ============================================================
async function runUpdateAllKtp() {
  const { meshToken, teacherId, academicYear, schedule } = await getState([
    "meshToken", "teacherId", "academicYear", "schedule"
  ]);
  if (!meshToken || !teacherId || !academicYear) return { ok: false, error: "Нет данных" };

  const groupIds = [...new Set((schedule || []).map((l) => l.groupId).filter(Boolean))];
  if (!groupIds.length) return { ok: false, error: "Нет групп" };

  const result = await updateAllKtp(meshToken, teacherId, academicYear.id, groupIds);

  await tickSchedule();
  setTimeout(() => tickSchedule().catch(() => {}), 3000);
  setTimeout(() => tickSchedule().catch(() => {}), 8000);

  return { ok: true, ...result };
}

// ============================================================
// Bulk: заполнить всё без ДЗ — с авто-догоном
// ============================================================
async function runBulkSetEmpty() {
  const { meshToken, teacherId, schedule } = await getState(["meshToken", "teacherId", "schedule"]);
  if (!meshToken || !teacherId) return { ok: false, error: "Нет данных" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const items = (schedule || [])
    .filter((l) => l.date >= todayIso && !l.has_homework && l.studentIds?.length)
    .map((l) => ({
      group_id: l.groupId, subject_id: l.subjectId,
      date: l.date, student_ids: l.studentIds
    }));

  if (!items.length) return { ok: true, total: 0, ok_count: 0, failed: [] };

  const result = await bulkSetEmptyHomework(meshToken, teacherId, items);

  await tickSchedule();
  setTimeout(() => tickSchedule().catch(() => {}), 3000);
  setTimeout(() => tickSchedule().catch(() => {}), 8000);

  return { ok: true, ...result };
}

// ============================================================
// Задать ДЗ на один урок — с авто-догоном
// ============================================================
async function runSetCustomHomework(lessonId, description) {
  const { meshToken, teacherId, schedule } = await getState(["meshToken", "teacherId", "schedule"]);
  if (!meshToken || !teacherId) return { ok: false, error: "Нет данных" };

  const lesson = (schedule || []).find((l) => String(l.id) === String(lessonId));
  if (!lesson) return { ok: false, error: "Урок не найден" };
  if (!lesson.studentIds?.length) return { ok: false, error: "Нет учеников" };

  try {
    await createHomework(meshToken, teacherId, {
      group_id: lesson.groupId, subject_id: lesson.subjectId,
      date_assigned_on: lesson.date, date_prepared_for: lesson.date,
      student_ids: lesson.studentIds, description
    });

    await tickSchedule();
    setTimeout(() => tickSchedule().catch(() => {}), 3000);

    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ============================================================
// Загрузка КТП
// ============================================================
async function reloadKtp() {
  const { meshToken, teacherId, academicYear, schedule } = await getState([
    "meshToken", "teacherId", "academicYear", "schedule"
  ]);
  if (!meshToken || !teacherId || !academicYear) return { ok: false, error: "Нет данных" };
  const groupIds = [...new Set((schedule || []).map((l) => l.groupId).filter(Boolean))];
  if (!groupIds.length) { await setState({ ktp: [] }); return { ok: true, count: 0 }; }
  const plans = await fetchCalendarPlans(meshToken, teacherId, academicYear.id, groupIds);
  const ktp = [];
  for (const plan of plans) {
    const details = await fetchCalendarPlan(meshToken, teacherId, plan.id);
    const lessons = details?.lessons || [];
    const withDate = lessons.filter((l) => l.date).length;
    const total = lessons.length;
    ktp.push({
      id: plan.id, groupId: plan.group_id,
      groupName: plan.group_name || `План #${plan.id}`,
      total, withDate, withoutDate: total - withDate,
      hasIssues: total > withDate,
      done: total > 0 && withDate === total
    });
  }
  await setState({ ktp });
  return { ok: true, count: ktp.length };
}

// ============================================================
// Загрузка ДЗ
// ============================================================
async function reloadHomework() {
  const { schedule } = await getState(["schedule"]);
  const homework = (schedule || []).map((l) => ({
    id: l.id, lessonId: l.id, date: l.date, time: l.time,
    title: l.lessonName || l.subjectName, subject: l.subjectName,
    groupName: l.groupName, has_homework: l.has_homework, done: l.has_homework
  }));
  await setState({ homework });
  return { ok: true, count: homework.length };
}

// ============================================================
// Обработчик сообщений
// ============================================================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const wrap = (fn) => {
    (async () => {
      try { sendResponse(await fn()); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    })();
    return true;
  };
  if (msg?.type === "refreshToken") return wrap(grabTokenFromTab);
  if (msg?.type === "refreshSchedule") return wrap(async () => { await tickSchedule(); return { ok: true }; });
  if (msg?.type === "refreshHomework") return wrap(reloadHomework);
  if (msg?.type === "refreshKtp") return wrap(reloadKtp);
  if (msg?.type === "recalcCriteria") return wrap(async () => { await recalcCriteria(); return { ok: true }; });
  if (msg?.type === "updateAllKtp") return wrap(runUpdateAllKtp);
  if (msg?.type === "bulkSetEmpty") return wrap(runBulkSetEmpty);
  if (msg?.type === "setCustomHomework") return wrap(() => runSetCustomHomework(msg.lessonId, msg.description));
  if (msg?.type === "launchNow") {
    return wrap(async () => {
      const { meshToken, teacherId } = await getState(["meshToken", "teacherId"]);
      const lesson = msg.lesson;
      if (!lesson.launchUrl && lesson.scriptUuid) {
        const m = await resolveMaterialUuids(meshToken, teacherId, [lesson.scriptUuid]);
        const res = m[lesson.scriptUuid];
        if (res?.original_uuid) {
          lesson.launchUrl = buildLaunchUrl(teacherId, res.original_uuid, lesson.subjectId, lesson.groupId);
        }
      }
      if (lesson.launchUrl) {
        chrome.tabs.create({ url: lesson.launchUrl, active: true });
        return { ok: true };
      }
      return { ok: false, error: "Нет launchUrl" };
    });
  }
  sendResponse({ ok: false, error: "Unknown: " + msg?.type });
  return false;
});

// ============================================================
// Клик по иконке — открыть dashboard.html в отдельном окне
// ============================================================
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("dashboard.html");
  const existing = await chrome.tabs.query({ url });
  if (existing.length > 0) {
    const tab = existing[0];
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tab.id, { active: true });
    return;
  }
  chrome.windows.create({ url, type: "popup", width: 1200, height: 820, focused: true });
});

console.log("[bg] background.js loaded");