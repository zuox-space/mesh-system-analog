// src/lib/academic-year.ts
import { cached, TTL } from "./cache";

export type AcademicYear = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
};

/**
 * Фолбэк: вычисляет границы учебного года по текущей дате.
 */
export function getAcademicYearFallback(): AcademicYear {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    id: 14,
    name: `${startYear}/${endYear}`,
    start_date: `${startYear}-09-01`,
    end_date: `${endYear}-08-31`,
  };
}

/**
 * Запрашивает у МЭШ список учебных годов и возвращает актуальный.
 * Кэшируется на 24 часа.
 */
export async function fetchCurrentAcademicYear(
  meshToken: string,
  teacherId: number
): Promise<AcademicYear> {
  return cached(`academic-year:${teacherId}`, TTL.ACADEMIC_YEAR, async () => {
    try {
      const r = await fetch(
        "https://school.mos.ru/api/ej/core/v1/academic_years",
        {
          headers: {
            authorization: `Bearer ${meshToken}`,
            "profile-id": String(teacherId),
            "x-mes-hostid": "9",
            "x-mes-roleid": "9",
            "x-mes-subsystem": "teacherweb",
            aid: "14",
            accept: "*/*",
          },
        }
      );

      if (!r.ok) {
        console.log(
          "[academic-year] API недоступен, использую расчёт по календарю"
        );
        return getAcademicYearFallback();
      }

      const data = await r.json();
      const years: any[] = Array.isArray(data)
        ? data
        : data.items || data.data || [];

      if (!years.length) {
        return getAcademicYearFallback();
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const y of years) {
        const start = y.start_date || y.date_start || y.begin_date;
        const end = y.end_date || y.date_end || y.finish_date;
        if (!start || !end) continue;

        const s = new Date(start);
        const e = new Date(end);
        if (today >= s && today <= e) {
          return {
            id: Number(y.id || y.academic_year_id),
            name: y.name || y.title || `${s.getFullYear()}/${e.getFullYear()}`,
            start_date: String(start).slice(0, 10),
            end_date: String(end).slice(0, 10),
          };
        }
      }

      const sorted = years
        .filter((y) => y.start_date || y.date_start)
        .sort((a, b) =>
          String(b.start_date || b.date_start).localeCompare(
            String(a.start_date || a.date_start)
          )
        );

      if (sorted[0]) {
        const y = sorted[0];
        return {
          id: Number(y.id || y.academic_year_id),
          name: y.name || y.title || "",
          start_date: String(y.start_date || y.date_start).slice(0, 10),
          end_date: String(y.end_date || y.date_end).slice(0, 10),
        };
      }

      return getAcademicYearFallback();
    } catch (e) {
      console.error("[academic-year] error:", e);
      return getAcademicYearFallback();
    }
  });
}