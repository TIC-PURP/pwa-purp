import { NextResponse } from "next/server";
import { couchFetch, apiError } from "../_utils";

/**
 * Body:
 * { email: string }
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return apiError(400, "email es requerido");

    const id = `org.couchdb.user:${email}`;

    // obtener _rev
    const get = await couchFetch(`/_users/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    const data = await get.json();

    if (get.status === 404) return apiError(404, "Usuario no existe");
    if (!get.ok) return apiError(get.status, "Error obteniendo usuario", data);

    const del = await couchFetch(
      `/_users/${encodeURIComponent(id)}?rev=${encodeURIComponent(data._rev)}`,
      { method: "DELETE" }
    );
    const delData = await del.json();
    if (!del.ok) return apiError(del.status, "No se pudo eliminar", delData);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
