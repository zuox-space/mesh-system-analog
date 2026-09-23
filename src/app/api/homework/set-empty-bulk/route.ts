// src/app/api/homework/set-empty-bulk/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function isoToDDMMYYYY(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
}

const DELAY_MS = 400;

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

    const tokenRow = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!tokenRow) return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ detail: "Пустой список" }, { status: 400 });
    }

    const meshToken = tokenRow.token;
    const teacherId = Number(user.profileId);

    const headers = {
        authorization: `Bearer ${meshToken}`,
        "content-type": "application/json",
        "profile-id": String(teacherId),
        "x-mes-hostid": "9",
        "x-mes-roleid": "9",
        "x-mes-subsystem": "teacherweb",
        aid: "14",
        accept: "*/*",
    };

    const results: { date: string; group_id: number; ok: boolean; error?: string }[] = [];

    for (const item of items) {
        const {
            group_id,
            subject_id,
            date_assigned_on,
            date_prepared_for,
            student_ids,
        } = item;

        if (!group_id || !subject_id || !date_assigned_on || !date_prepared_for ||
            !Array.isArray(student_ids) || student_ids.length === 0) {
            results.push({
                date: date_assigned_on || "—",
                group_id: Number(group_id),
                ok: false,
                error: "Не хватает полей",
            });
            continue;
        }

        const payload = {
            group_id: Number(group_id),
            teacher_id: teacherId,
            date_assigned_on: isoToDDMMYYYY(date_assigned_on),
            date_prepared_for: isoToDDMMYYYY(date_prepared_for),
            subject_id: Number(subject_id),
            homework_entries: [
                {
                    description: "Без домашнего задания",
                    duration: 15,
                    student_ids: student_ids.map((x: any) => Number(x)),
                    attachment_ids: [],
                    attachments: [],
                    scripts: null,
                },
            ],
        };

        try {
            const r = await fetch(
                "https://school.mos.ru/api/ej/core/teacher/v1/homeworks",
                { method: "POST", headers, body: JSON.stringify(payload) }
            );

            if (!r.ok) {
                const t = await r.text();
                results.push({
                    date: date_assigned_on,
                    group_id: Number(group_id),
                    ok: false,
                    error: `HTTP ${r.status}: ${t.slice(0, 100)}`,
                });
            } else {
                results.push({
                    date: date_assigned_on,
                    group_id: Number(group_id),
                    ok: true,
                });
            }
        } catch (e: any) {
            results.push({
                date: date_assigned_on,
                group_id: Number(group_id),
                ok: false,
                error: e.message,
            });
        }

        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    await prisma.logEntry.create({
        data: {
            userId: user.id,
            action: "HOMEWORK_BULK_EMPTY",
            details: `total=${results.length} ok=${ok} failed=${failed.length}`,
        },
    });

    return NextResponse.json({
        ok: true,
        total: results.length,
        ok_count: ok,
        failed,
        results,
    });
}