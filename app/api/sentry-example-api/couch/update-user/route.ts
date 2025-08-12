import { NextResponse } from "next/server";
import { couchFetch, apiError } from "../_utils";

/**
 * Body esperado:
 * {
 *   email: string,              // actual (obligatorio)
 *   password?: string,          // opcional (cambia pass)
 *   roles?: string[],           // opcional
 *   isActive?: boolean,         // opcional (banderita informativa)
 *   newEmail?: string           // opcional: renombrar usuario (requiere password)
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, roles, isActive, newEmail } = body || {};

    if (!email) return apiError(400, "email es requerido");

    // 1) Leer doc actual
    const id = `org.couchdb.user:${email}`;
    const get = await couchFetch(`/_users/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    const current = await get.json();

    if (get.status === 404) return apiError(404, "Usuario no existe");
    if (!get.ok) return apiError(get.status, "Error obteniendo usuario", current);

    // 2) Si hay renombre (cambiar email = username)
    if (newEmail && newEmail !== email) {
      if (!password) {
        return apiError(
          400,
          "Para cambiar email/username debes enviar un password (se vuelve a fijar)"
        );
      }

      // crear nuevo doc con newEmail
      const newId = `org.couchdb.user:${newEmail}`;
      const newDoc = {
        _id: newId,
        name: newEmail,
        type: "user",
        roles: Array.isArray(roles) ? roles : current.roles,
        email: newEmail,
        isActive: typeof isActive === "boolean" ? isActive : current.isActive,
        password, // necesario al crear
      };

      const putNew = await couchFetch(`/_users/${encodeURIComponent(newId)}`, {
        method: "PUT",
        body: JSON.stringify(newDoc),
      });
      const putNewData = await putNew.json();
      if (!putNew.ok) {
        return apiError(putNew.status, "No se pudo crear el nuevo usuario", putNewData);
      }

      // borrar el viejo
      const delOld = await couchFetch(
        `/_users/${encodeURIComponent(id)}?rev=${encodeURIComponent(
          current._rev
        )}`,
        { method: "DELETE" }
      );
      const delData = await delOld.json();
      if (!delOld.ok) {
        return apiError(delOld.status, "Nuevo creado, pero no se pudo borrar el anterior", delData);
      }

      return NextResponse.json({ ok: true, migrated: true });
    }

    // 3) Actualización "in-place" (sin renombrar)
    const updated = {
      ...current,
      // Mantén _id/_rev
      roles: Array.isArray(roles) ? roles : current.roles,
      email: current.email ?? email,
      isActive: typeof isActive === "boolean" ? isActive : current.isActive,
      // Si envías password Couch lo regenera; si no, queda igual
      ...(password ? { password } : {}),
    };

    const put = await couchFetch(`/_users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updated),
    });
    const putData = await put.json();
    if (!put.ok) return apiError(put.status, "No se pudo actualizar", putData);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
