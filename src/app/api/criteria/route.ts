// src/app/api/criteria/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";
import { fetchHomeworkPresence } from "@/lib/mesh-homework";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";

type PeriodLesson = {
  group_id: number;
  group_name: string;
  date: string;
  time: string;
  lesson_name: string;
  subject_id: number;
  student_ids: number[];
  has_homework: boolean;
  has_ktp: boolean;
  is_launched: boolean;
  plan_id: number | null;
};

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function getReportPeriod(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();

  let from: Date;
  let to: Date;

  if (day >= 16) {
    from = new Date(y, m, 16);
    to = new Date(y, m + 1, 15);
  } else {
    from = new Date(y, m - 1, 16);
    to = new Date(y, m, 15);
  }

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

  return { from: fmt(from), to: fmt(to) };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const tokenRow = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  if (!tokenRow || (tokenRow.expiresAt && tokenRow.expiresAt < new Date())) {
    return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });
  }

  if (!user.profileId) {
    return NextResponse.json({ detail: "Нет profile_id" }, { status: 400 });
  }

  const meshToken = tokenRow.token;
  const teacherId = Number(user.profileId);

  const headers = {
    authorization: `Bearer ${meshToken}`,
    "profile-id": String(teacherId),
    "x-mes-hostid": "9",
    "x-mes-roleid": "9",
    "x-mes-subsystem": "teacherweb",
    aid: "14",
    accept: "*/*",
  };

  const period = getReportPeriod();
  const todayIso = isoToday();

  try {
    const academicYear = await fetchCurrentAcademicYear(meshToken, teacherId);

    const url = new URL(
      "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
    );
    url.searchParams.set("academic_year_id", String(academicYear.id));
    url.searchParams.set("teacher_id", String(teacherId));
    url.searchParams.set("from", period.from);
    url.searchParams.set("to", period.to);
    url.searchParams.set("with_group_class_subject_info", "true");
    url.searchParams.set("with_lesson_info", "true");
    url.searchParams.set("with_course_calendar_info", "true");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "2000");
    url.searchParams.set("original", "true");

    // ============ Расписание с кэшем ============
    const scheduleCacheKey = `schedule:${teacherId}:${period.from}:${period.to}`;
    let data = cacheGet<any>(scheduleCacheKey);

    if (data) {
      console.log("[criteria] schedule from cache");
    } else {
      const r = await fetch(url.toString(), { headers, cache: "no-store" });
      if (!r.ok) {
        const text = await r.text();
        return NextResponse.json(
          { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 300) },
          { status: r.status }
        );
      }
      data = await r.json();
      cacheSet(scheduleCacheKey, data, TTL.SCHEDULE);
      console.log("[criteria] schedule cached");
    }

    const items = Array.isArray(data) ? data : data.items || data.data || [];

    // ============ План пользователя (для критерия «Запуск») ============
    const plan = await prisma.lessonPlan.findUnique({
      where: { userId: user.id },
      include: { lessons: true },
    });

    const planStatusMap = new Map<string, string>();
    if (plan) {
      for (const pl of plan.lessons) {
        const key = `${pl.date}|${pl.time}|${pl.groupId}`;
        planStatusMap.set(key, pl.status);
      }
    }

    // ============ Группы ============
    const groupsMap = new Map<
      number,
      {
        group_id: number;
        group_name: string;
        class_unit_id: number | null;
        student_ids: number[];
      }
    >();

    for (const lesson of items) {
      if (lesson.cancelled) continue;
      if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
      if (lesson.replaced) {
        const rid = lesson.replaced_teacher_id;
        if (rid && Number(rid) !== teacherId) continue;
      }
      const gid = Number(lesson.group_id);
      if (!gid) continue;
      if (!groupsMap.has(gid)) {
        groupsMap.set(gid, {
          group_id: gid,
          group_name: lesson.group_name || lesson.class_unit_name || "",
          class_unit_id: lesson.class_unit_id
            ? Number(lesson.class_unit_id)
            : null,
          student_ids: [],
        });
      }
    }

    // ============ Ученики ============
    const CONCURRENCY = 5;
    const groupList = [...groupsMap.values()];
    for (let i = 0; i < groupList.length; i += CONCURRENCY) {
      const chunk = groupList.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (g) => {
          const studentsCacheKey = `students:${g.group_id}`;
          const cachedIds = cacheGet<number[]>(studentsCacheKey);
          if (cachedIds) {
            g.student_ids = cachedIds;
            return;
          }

          if (!g.class_unit_id) return;

          try {
            const studentsUrl = new URL(
              "https://school.mos.ru/api/ej/core/teacher/v1/student_profiles"
            );
            studentsUrl.searchParams.set(
              "academic_year_id",
              String(academicYear.id)
            );
            studentsUrl.searchParams.set(
              "class_unit_ids",
              String(g.class_unit_id)
            );
            studentsUrl.searchParams.set("group_ids", String(g.group_id));
            studentsUrl.searchParams.set("with_groups", "true");
            studentsUrl.searchParams.set("with_deleted", "false");
            studentsUrl.searchParams.set("with_archived_groups", "false");
            studentsUrl.searchParams.set("with_transferred", "false");
            studentsUrl.searchParams.set("per_page", "150");
            studentsUrl.searchParams.set("page", "1");

            const sRes = await fetch(studentsUrl.toString(), {
              headers: { ...headers, "x-mes-subsystem": "journalw" },
            });
            if (!sRes.ok) return;
            const sData = await sRes.json();
            const sList = Array.isArray(sData)
              ? sData
              : sData.items || sData.data || [];
            const ids: number[] = [];
            for (const s of sList) {
              const sid = Number(s.id || s.student_id);
              if (sid) ids.push(sid);
            }
            if (ids.length) {
              g.student_ids = ids;
              cacheSet(studentsCacheKey, ids, TTL.STUDENTS);
            }
          } catch { }
        })
      );
    }

    // ============ Presence (ДЗ) ============
    const lessonIdsToCheck: number[] = [];
    for (const lesson of items) {
      if (lesson.cancelled) continue;
      if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
      if (lesson.replaced) {
        const rid = lesson.replaced_teacher_id;
        if (rid && Number(rid) !== teacherId) continue;
      }
      const id = Number(lesson.id);
      if (id) lessonIdsToCheck.push(id);
    }

    const presenceMap = await fetchHomeworkPresence(
      meshToken,
      teacherId,
      lessonIdsToCheck
    );
    console.log(`[criteria] presence loaded: ${presenceMap.size}`);

    // ============ Уроки ============
    const lessons: PeriodLesson[] = [];

    for (const lesson of items) {
      if (lesson.cancelled) continue;
      if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
      if (lesson.replaced) {
        const rid = lesson.replaced_teacher_id;
        if (rid && Number(rid) !== teacherId) continue;
      }

      const d = lesson.date;
      if (!Array.isArray(d)) continue;
      const dateIso = `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(
        d[2]
      ).padStart(2, "0")}`;

      const t = lesson.time || [];
      const timeStr =
        Array.isArray(t) && t.length >= 2
          ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`
          : "";

      const hasKtp = !!(lesson.topic_id || lesson.calendar_plan_id);
      const planId = lesson.calendar_plan_id
        ? Number(lesson.calendar_plan_id)
        : null;

      const toGive = Array.isArray(lesson.homeworks_to_give)
        ? lesson.homeworks_to_give
        : [];
      const hasToGive = toGive.length > 0;

      const presence = presenceMap.get(Number(lesson.id));
      const isAbsences = presence?.is_homework_absences === true;
      const isExist = presence?.is_homework_exist === true;

      // ДЗ задано, если: to_give, ИЛИ presence (exist), ИЛИ presence (absences)
      const hasHomework = hasToGive || isAbsences || isExist;

      const gid = Number(lesson.group_id);
      const grp = groupsMap.get(gid);

      const planKey = `${dateIso}|${timeStr}|${gid}`;
      const planStatus = planStatusMap.get(planKey);
      const isLaunched =
        planStatus === "finished" || planStatus === "running";

      lessons.push({
        group_id: gid,
        group_name: lesson.group_name || lesson.class_unit_name || "",
        date: dateIso,
        time: timeStr,
        lesson_name: lesson.lesson_name || "",
        subject_id: Number(lesson.subject_id) || 0,
        student_ids: grp?.student_ids || [],
        has_homework: hasHomework,
        has_ktp: hasKtp,
        is_launched: isLaunched,
        plan_id: planId,
      });
    }

    const pastLessons = lessons.filter((l) => l.date < todayIso);
    const futureLessons = lessons.filter((l) => l.date >= todayIso);

    const totalAll = lessons.length;

    // ============ КТП (цель 95%) ============
    const ktpDone = lessons.filter((l) => l.has_ktp).length;
    const ktpFuturePossible = futureLessons.filter((l) => !l.has_ktp).length;
    const ktpMaxPossible = ktpDone + ktpFuturePossible;

    const ktpPercent = totalAll > 0 ? (ktpDone / totalAll) * 100 : 0;
    const ktpMaxPercent = totalAll > 0 ? (ktpMaxPossible / totalAll) * 100 : 0;
    const ktpTarget = 95;
    const ktpPassed = ktpPercent >= ktpTarget;
    const ktpReachable = ktpMaxPercent >= ktpTarget;

    // ============ ДЗ (цель 95%) ============
    const hwDone = lessons.filter((l) => l.has_homework).length;
    const hwFuturePossible = futureLessons.filter(
      (l) => !l.has_homework
    ).length;
    const hwMaxPossible = hwDone + hwFuturePossible;

    const hwPercent = totalAll > 0 ? (hwDone / totalAll) * 100 : 0;
    const hwMaxPercent = totalAll > 0 ? (hwMaxPossible / totalAll) * 100 : 0;
    const hwTarget = 95;
    const hwPassed = hwPercent >= hwTarget;
    const hwReachable = hwMaxPercent >= hwTarget;

    // ============ Запуск (цель 30%) ============
    const launchDone = lessons.filter((l) => l.is_launched).length;
    const launchFuturePossible = futureLessons.filter(
      (l) => !l.is_launched
    ).length;
    const launchMaxPossible = launchDone + launchFuturePossible;

    const launchPercent = totalAll > 0 ? (launchDone / totalAll) * 100 : 0;
    const launchMaxPercent =
      totalAll > 0 ? (launchMaxPossible / totalAll) * 100 : 0;
    const launchTarget = 30;
    const launchPassed = launchPercent >= launchTarget;
    const launchReachable = launchMaxPercent >= launchTarget;

    // ============ Проблемные уроки ============
    const ktpProblemLessons = lessons.filter((l) => !l.has_ktp);
    const hwProblemLessons = lessons.filter((l) => !l.has_homework);
    const launchProblemLessons = lessons.filter((l) => !l.is_launched);

    const sortProblems = (arr: PeriodLesson[]) =>
      [...arr].sort((a, b) => {
        const aFuture = a.date >= todayIso;
        const bFuture = b.date >= todayIso;
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        return a.date.localeCompare(b.date);
      });

    return NextResponse.json({
      ok: true,
      criteria: {
        period,
        today: todayIso,
        total_lessons: totalAll,
        total_past: pastLessons.length,
        total_future: futureLessons.length,

        ktp_linked: ktpDone,
        ktp_missing: totalAll - ktpDone,
        ktp_percent: Math.round(ktpPercent * 10) / 10,
        ktp_max_percent: Math.round(ktpMaxPercent * 10) / 10,
        ktp_target: ktpTarget,
        ktp_passed: ktpPassed,
        ktp_reachable: ktpReachable,
        ktp_missing_lessons: sortProblems(ktpProblemLessons),

        hw_given: hwDone,
        hw_missing: totalAll - hwDone,
        hw_percent: Math.round(hwPercent * 10) / 10,
        hw_max_percent: Math.round(hwMaxPercent * 10) / 10,
        hw_target: hwTarget,
        hw_passed: hwPassed,
        hw_reachable: hwReachable,
        hw_missing_lessons: sortProblems(hwProblemLessons),

        launch_done: launchDone,
        launch_missing: totalAll - launchDone,
        launch_percent: Math.round(launchPercent * 10) / 10,
        launch_max_percent: Math.round(launchMaxPercent * 10) / 10,
        launch_target: launchTarget,
        launch_passed: launchPassed,
        launch_reachable: launchReachable,
        launch_missing_lessons: sortProblems(launchProblemLessons),

        overall_passed: ktpPassed && hwPassed && launchPassed,
        overall_reachable: ktpReachable && hwReachable && launchReachable,
      },
    });
  } catch (e: any) {
    console.error("[criteria] error:", e);
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}