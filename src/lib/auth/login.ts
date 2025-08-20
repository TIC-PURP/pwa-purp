// Login helper contra /api/couch/_session
export async function login(email: string, password: string) {
  const res = await fetch("/api/couch/_session", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
    body: new URLSearchParams({ name: email, password })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Credenciales inválidas o error de sesión: ${txt}`);
  }
  return true;
}
