// src/lib/mesh.ts

export type MeshPayload = {
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
};

export function decodeMeshToken(token: string): MeshPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      console.error("[mesh] JWT has less than 2 parts");
      return null;
    }
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as MeshPayload;
  } catch (e) {
    console.error("[mesh] decodeMeshToken failed:", e);
    return null;
  }
}

export function expToDate(exp?: number): Date | null {
  if (!exp || typeof exp !== "number") return null;
  const d = new Date(exp * 1000);
  return isNaN(d.getTime()) ? null : d;
}

export function iatToDate(iat?: number): Date | null {
  if (!iat || typeof iat !== "number") return null;
  const d = new Date(iat * 1000);
  return isNaN(d.getTime()) ? null : d;
}

export type MeshUserInfo = {
  sub: string;
  email?: string;
  phone?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  birth_date?: string;
  picture?: { medium?: string; large?: string };
  broles?: string[];
};

export async function fetchMeshUserInfo(token: string): Promise<MeshUserInfo | null> {
  try {
    const r = await fetch("https://school.mos.ru/v1/oauth/userinfo", {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });

    if (!r.ok) {
      console.warn("[mesh] userinfo fetch failed:", r.status);
      return null;
    }

    return (await r.json()) as MeshUserInfo;
  } catch (e) {
    console.error("[mesh] fetchMeshUserInfo error:", e);
    return null;
  }
}

export type MeshProfile = {
  id: number;
  type: string;
  roles: string[];
  user_id: number;
  school_id: number;
  school_name?: string;
  subject_ids?: number[];
};

export type MeshSession = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  phone_number?: string;
  profiles: MeshProfile[];
};

export async function fetchMeshSession(token: string): Promise<MeshSession | null> {
  try {
    const r = await fetch("https://school.mos.ru/api/ej/acl/v1/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-mes-hostid": "9",
        "x-mes-roleid": "9",
        "x-mes-subsystem": "teacherweb",
        aid: "14",
        accept: "application/json",
      },
      body: JSON.stringify({ auth_token: token }),
    });

    if (!r.ok) {
      console.warn("[mesh] sessions fetch failed:", r.status);
      return null;
    }

    return (await r.json()) as MeshSession;
  } catch (e) {
    console.error("[mesh] fetchMeshSession error:", e);
    return null;
  }
}

export function findTeacherProfile(session: MeshSession): MeshProfile | null {
  if (!session?.profiles?.length) return null;
  return (
    session.profiles.find((p) => p.type === "teacher") ||
    session.profiles[0] ||
    null
  );
}