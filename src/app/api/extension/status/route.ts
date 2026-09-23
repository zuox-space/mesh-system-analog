import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const linked = !!user.extensionToken;

  return NextResponse.json({
    ok: true,
    linked,
    pairCode: user.pairCode,
    pairCodeExpires: user.pairCodeExpires?.toISOString() || null,
    extensionToken: linked ? user.extensionToken : null,
  });
}