// src/lib/auth/login.ts
export async function loginOnline(data: { email: string; password: string }) {
  const response = await fetch("/api/couch/_session", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `name=${encodeURIComponent(data.email)}&password=${encodeURIComponent(data.password)}`,
    credentials: "include",
  });

  if (!response.ok) throw new Error("Error en login online");

  const user = await response.json();
  // Ajusta role según tu API real
  return { user, token: "online-token", role: "user" };
}
