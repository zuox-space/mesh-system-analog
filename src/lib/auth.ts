import { cookies } from "next/headers";
import { verifySession, SessionPayload } from "./jwt";
import { prisma } from "./prisma";

const COOKIE_NAME = "mesh_session";

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function requireActiveUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.accessStatus !== "ACTIVE") return null;
  return user;
}

export const SESSION_COOKIE = COOKIE_NAME;