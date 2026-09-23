import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    sub: user.sub,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    role: user.role,
  });
}