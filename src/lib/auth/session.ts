export type CouchSession = {
  ok?: boolean;
  userCtx?: { name?: string; roles?: string[] };
  info?: any;
  error?: string;
};

export async function getSession(): Promise<CouchSession> {
  const res = await fetch("/api/couch/_session", {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) return { ok: false, error: `status ${res.status}` } as any;
  return (await res.json()) as CouchSession;
}

export async function logout() {
  await fetch("/api/couch/_session", {
    method: "DELETE",
    credentials: "include",
  });
}
