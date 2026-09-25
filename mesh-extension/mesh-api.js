// mesh-api.js
const BASE = "https://school.mos.ru";

function teacherHeaders(meshToken, teacherId, subsystem = "teacherweb") {
  return {
    authorization: `Bearer ${meshToken}`,
    "profile-id": String(teacherId),
    "x-mes-hostid": "9",
    "x-mes-roleid": "9",
    "x-mes-subsystem": subsystem,
    aid: "14",
    accept: "*/*"
  };
}

export async function fetchSession(meshToken) {
  const r = await fetch(`${BASE}/api/ej/acl/v1/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${meshToken}`,
      "content-type": "application/json",
      "x-mes-hostid": "9", "x-mes-roleid": "9",
      "x-mes-subsystem": "teacherweb", aid: "14",
      accept: "application/json"
    },
    body: JSON.stringify({ auth_token: meshToken })
  });
  if (!r.ok) throw new Error(`sessions ${r.status}`);
  return r.json();
}

export function findTeacherProfile(session) {
  if (!session?.profiles?.length) return null;
  return session.profiles.find((p) => p.type === "teacher") || session.profiles[0] || null;
}

export async function fetchUserInfo(meshToken) {
  const r = await fetch(`${BASE}/v1/oauth/userinfo`, {
    headers: { authorization: `Bearer ${meshToken}`, accept: "application/json" }
  });
  if (!r.ok) return null;
  return r.json();
}

export async function fetchAcademicYear(meshToken, teacherId) {
  try {
    const r = await fetch(`${BASE}/api/ej/core/v1/academic_years`, {
      headers: teacherHeaders(meshToken, teacherId)
    });
    if (r.ok) {
      const data = await r.json();
      const years = Array.isArray(data) ? data : data.items || data.data || [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (const y of years) {
        const s = new Date(y.start_date || y.date_start);
        const e = new Date(y.end_date || y.date_end);
        if (today >= s && today <= e) {
          return {
            id: Number(y.id || y.academic_year_id),
            name: y.name || "",
            start_date: String(y.start_date || y.date_start).slice(0, 10),
            end_date: String(y.end_date || y.date_end).slice(0, 10)
          };
        }
      }
      if (years[0]) {
        const y = years[0];
        return {
          id: Number(y.id || y.academic_year_id),
          name: y.name || "",
          start_date: String(y.start_date || y.date_start).slice(0, 10),
          end_date: String(y.end_date || y.date_end).slice(0, 10)
        };
      }
    }
  } catch (e) {}
  const now = new Date();
  const sy = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return { id: 14, name: `${sy}/${sy + 1}`, start_date: `${sy}-09-01`, end_date: `${sy + 1}-08-31` };
}

export async function fetchScheduleItems(meshToken, teacherId, academicYearId, from, to) {
  const url = new URL(`${BASE}/api/ej/plan/teacher/v1/schedule_items`);
  url.searchParams.set("academic_year_id", String(academicYearId));
  url.searchParams.set("teacher_id", String(teacherId));
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("with_group_class_subject_info", "true");
  url.searchParams.set("with_lesson_info", "true");
  url.searchParams.set("with_course_calendar_info", "true");
  url.searchParams.set("with_rooms_info", "true");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "2000");
  url.searchParams.set("original", "true");
  const r = await fetch(url.toString(), { headers: teacherHeaders(meshToken, teacherId) });
  if (!r.ok) throw new Error(`schedule_items ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : data.items || data.data || [];
}

export async function fetchRooms(meshToken, teacherId) {
  const r = await fetch(`${BASE}/api/ej/core/teacher/v1/rooms`, {
    headers: teacherHeaders(meshToken, teacherId)
  });
  if (!r.ok) return {};
  const data = await r.json();
  const list = Array.isArray(data) ? data : data.items || data.data || [];
  const map = {};
  for (const room of list) {
    const id = Number(room.id);
    if (!id) continue;
    const label = (room.number && String(room.number).trim()) ||
                  (room.name && String(room.name).trim()) || "";
    if (label) map[id] = label;
  }
  return map;
}

export async function fetchStudents(meshToken, teacherId, academicYearId, classUnitId, groupId) {
  const url = new URL(`${BASE}/api/ej/core/teacher/v1/student_profiles`);
  url.searchParams.set("academic_year_id", String(academicYearId));
  url.searchParams.set("class_unit_ids", String(classUnitId));
  url.searchParams.set("group_ids", String(groupId));
  url.searchParams.set("with_groups", "true");
  url.searchParams.set("with_deleted", "false");
  url.searchParams.set("with_archived_groups", "false");
  url.searchParams.set("with_transferred", "false");
  url.searchParams.set("per_page", "150");
  url.searchParams.set("page", "1");
  const r = await fetch(url.toString(), { headers: teacherHeaders(meshToken, teacherId, "journalw") });
  if (!r.ok) return [];
  const data = await r.json();
  const list = Array.isArray(data) ? data : data.items || data.data || [];
  return list.map((s) => Number(s.id || s.student_id)).filter(Boolean);
}

export async function fetchHomeworkPresence(meshToken, teacherId, lessonIds) {
  const result = new Map();
  if (!lessonIds.length) return result;
  const CHUNK = 100;
  for (let i = 0; i < lessonIds.length; i += CHUNK) {
    const chunk = lessonIds.slice(i, i + CHUNK);
    const idsParam = [...chunk].sort((a, b) => a - b).join(",");
    try {
      const url = new URL(`${BASE}/api/ej/core/teacher/v1/homework_presence`);
      url.searchParams.set("lesson_schedule_item_ids", idsParam);
      const r = await fetch(url.toString(), { headers: teacherHeaders(meshToken, teacherId) });
      if (!r.ok) continue;
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.items || data.data || [];
      for (const p of list) result.set(p.lesson_schedule_item_id, p);
    } catch (e) {}
  }
  return result;
}

function isoToDDMMYYYY(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function createHomework(meshToken, teacherId, params) {
  const { group_id, subject_id, date_assigned_on, date_prepared_for, student_ids, description } = params;
  const payload = {
    group_id: Number(group_id),
    teacher_id: teacherId,
    date_assigned_on: isoToDDMMYYYY(date_assigned_on),
    date_prepared_for: isoToDDMMYYYY(date_prepared_for),
    subject_id: Number(subject_id),
    homework_entries: [{
      description: String(description),
      duration: 15,
      student_ids: student_ids.map(Number),
      attachment_ids: [],
      attachments: [],
      scripts: null
    }]
  };
  const r = await fetch(`${BASE}/api/ej/core/teacher/v1/homeworks`, {
    method: "POST",
    headers: { ...teacherHeaders(meshToken, teacherId), "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`create homework ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

export async function fetchCalendarPlans(meshToken, teacherId, academicYearId, groupIds) {
  const url = new URL(`${BASE}/api/ej/plan/teacher/v1/calendar_plans`);
  url.searchParams.set("academic_year_id", String(academicYearId));
  url.searchParams.set("group_id", groupIds.join(","));
  const r = await fetch(url.toString(), { headers: teacherHeaders(meshToken, teacherId, "ppktpw") });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : data.items || data.data || [];
}

export async function fetchCalendarPlan(meshToken, teacherId, planId) {
  const r = await fetch(`${BASE}/api/ej/plan/teacher/v1/calendar_plans/${planId}`,
    { headers: teacherHeaders(meshToken, teacherId, "ppktpw") });
  if (!r.ok) return null;
  return r.json();
}

export async function ktpFinishAndRecalc(meshToken, teacherId, planId) {
  const h = teacherHeaders(meshToken, teacherId);
  const r1 = await fetch(`${BASE}/api/ej/plan/teacher/v1/calendar_plans/${planId}/finish?ignore_IA=true`,
    { method: "POST", headers: h });
  if (!r1.ok) throw new Error(`finish ${r1.status}`);
  const r2 = await fetch(`${BASE}/api/ej/plan/teacher/v1/calendar_plans/${planId}/recalc?ignore_IA=true`,
    { method: "POST", headers: h });
  if (!r2.ok) throw new Error(`recalc ${r2.status}`);
  return { ok: true };
}

export async function resolveMaterialUuids(meshToken, teacherId, uuids) {
  const result = {};
  if (!uuids.length) return result;
  const CHUNK = 50;
  for (let i = 0; i < uuids.length; i += CHUNK) {
    const chunk = uuids.slice(i, i + CHUNK);
    try {
      const r = await fetch(`${BASE}/api/materials/v3/materials/bulk/uuids`, {
        method: "POST",
        headers: { ...teacherHeaders(meshToken, teacherId), "content-type": "application/json" },
        body: JSON.stringify(chunk)
      });
      if (!r.ok) continue;
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.items || data.data || [];
      for (const m of list) {
        if (!m.uuid || !m.original_uuid) continue;
        result[m.uuid] = { original_uuid: String(m.original_uuid), name: String(m.name || "") };
      }
    } catch (e) {}
  }
  return result;
}

export function buildLaunchUrl(teacherId, materialUuid, subjectId, groupId) {
  const activityUrl = `https://uchebnik.mos.ru/cms/materials/${materialUuid}/launch?teacher_id=${teacherId}&subject_id=${subjectId}&group_id=${groupId}&mode=management`;
  return `${BASE}/api/launcher/v1/launch?activity_url=${encodeURIComponent(activityUrl)}`;
}

export async function updateAllKtp(meshToken, teacherId, academicYearId, groupIds) {
  const plans = await fetchCalendarPlans(meshToken, teacherId, academicYearId, groupIds);
  const planIds = plans.map((p) => Number(p.id)).filter(Boolean);
  const CONCURRENCY = 3;
  const results = [];
  for (let i = 0; i < planIds.length; i += CONCURRENCY) {
    const chunk = planIds.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(async (pid) => {
      const plan = plans.find((p) => Number(p.id) === pid);
      try {
        await ktpFinishAndRecalc(meshToken, teacherId, pid);
        return { plan_id: pid, group_name: plan?.group_name, ok: true };
      } catch (e) {
        return { plan_id: pid, group_name: plan?.group_name, ok: false, error: String(e) };
      }
    }));
    results.push(...chunkResults);
  }
  return {
    total: planIds.length,
    ok_count: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok)
  };
}

export async function bulkSetEmptyHomework(meshToken, teacherId, items, onProgress) {
  const DELAY_MS = 400;
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await createHomework(meshToken, teacherId, {
        group_id: item.group_id,
        subject_id: item.subject_id,
        date_assigned_on: item.date,
        date_prepared_for: item.date,
        student_ids: item.student_ids,
        description: "Без домашнего задания"
      });
      results.push({ ...item, ok: true });
    } catch (e) {
      results.push({ ...item, ok: false, error: String(e) });
    }
    if (onProgress) onProgress(i + 1, items.length);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  return {
    total: results.length,
    ok_count: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok)
  };
}