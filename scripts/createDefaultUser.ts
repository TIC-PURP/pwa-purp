import PouchDB from "pouchdb";
import type { User } from "@/lib/types";

const localDB = new PouchDB("gestion_pwa_local");

const defaultUser: User = {
  id: "user_manager_purp",
  email: "manager@purp.com.mx",
  password: "Purp2023@",
  role: "manager",
  name: "Mario Acosta",
  permissions: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export async function createUserIfNotExists() {
  try {
    const result = await localDB.find({
      selector: { email: defaultUser.email },
      limit: 1,
    });

    if (result.docs.length > 0) {
      console.log("✅ El usuario ya existe:", (result.docs[0] as User).email);
      return;
    }

    await localDB.put({
      _id: defaultUser.id,
      ...defaultUser,
    });

    console.log("✅ Usuario creado exitosamente.");
  } catch (error) {
    console.error("❌ Error al crear el usuario:", error);
  }
}

// ❌ No ejecutar automáticamente. Solo ejecutar manualmente si es necesario.
// createUserIfNotExists()
