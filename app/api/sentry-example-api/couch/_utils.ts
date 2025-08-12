import { NextResponse } from "next/server";

export const COUCH_BASE =
  (process.env.COUCH_ADMIN_URL || "").replace(/\/+$/, "");

const adminUser = process.env.COUCH_ADMIN_USER || "";
const adminPass = process.env.COUCH_ADMIN_PASS || "";

export function authHeader() {
  const b64 = Buffer.from(`${adminUser}:${adminPass}`).toString("base64");
  return { Authorization: `Basic ${b64}` };
}

export async function couchFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!COUCH_BASE || !adminUser || !adminPass) {
    throw new Error(
      "Faltan COUCH_ADMIN_URL / COUCH_ADMIN_USER / COUCH_ADMIN_PASS en .env.local"
    );
  }
  const url = `${COUCH_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...authHeader(),
    },
  });
}

export function apiError(status: number, message: string, extra?: any) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}
