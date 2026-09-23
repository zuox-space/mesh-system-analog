// src/app/api/homework/set-custom/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function isoToDDMMYYYY(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

    const tokenRow = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!tokenRow) return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const {
        group_id,
        subject_id,
        date_assigned_on,
        date_prepared_for,
        student_ids,
        description,
    } = body;

    if (!group_id || !subject_id || !date_assigned_on || !date_prepared_for) {
        return NextResponse.json(
            { detail: "Нужны group_id, subject_id, date_assigned_on, date_prepared_for" },
            { status: 400 }
        );
    }

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return NextResponse.json({ detail: "Пустой список учеников" }, { status: 400 });
    }

    if (!description || !String(description).trim()) {
        return NextResponse.json({ detail: "Пустой текст ДЗ" }, { status: 400 });
    }

    const meshToken = tokenRow.token;
    const teacherId = Number(user.profileId);

    const payload = {
        group_id: Number(group_id),
        teacher_id: teacherId,
        date_assigned_on: isoToDDMMYYYY(date_assigned_on),
        date_prepared_for: isoToDDMMYYYY(date_prepared_for),
        subject_id: Number(subject_id),
        homework_entries: [
            {
                description: String(description),
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
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${meshToken}`,
                    "content-type": "application/json",
                    "profile-id": String(teacherId),
                    "x-mes-hostid": "9",
                    "x-mes-roleid": "9",
                    "x-mes-subsystem": "teacherweb",
                    aid: "14",
                    accept: "*/*",
                },
                body: JSON.stringify(payload),
            }
        );

        const text = await r.text();
        if (!r.ok) {
            return NextResponse.json(
                { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 500) },
                { status: r.status }
            );
        }

        let data: any = {};
        try { data = JSON.parse(text); } catch { }

        await prisma.logEntry.create({
            data: {
                userId: user.id,
                action: "HOMEWORK_SET_CUSTOM",
                details: `group=${group_id} date=${date_assigned_on}`,
            },
        });

        return NextResponse.json({ ok: true, homework: data });
    } catch (e: any) {
        return NextResponse.json({ detail: e.message }, { status: 500 });
    }
}