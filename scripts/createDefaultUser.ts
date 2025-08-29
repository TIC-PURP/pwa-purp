// Script utilitario para asegurar la existencia de un usuario por defecto.
// Puede ejecutarse manualmente o desde tareas de despliegue para crear
// un administrador inicial en las bases de datos local y remota.
import "dotenv/config";
import PouchDB from "pouchdb";
import PouchFind from "pouchdb-find";
import type { User } from "../src/lib/types";
import { getCouchEnv } from "../src/lib/database";

PouchDB.plugin(PouchFind);

const { dbName, serverBase } = getCouchEnv();
const localDB = new PouchDB(`${dbName}_local`);
const remoteDB = new PouchDB(`${serverBase}/${encodeURIComponent(dbName)}`, {
  skip_setup: true,
});

const defaultUser: User = {
  id: "user_manager_purp",
  email: "manager@purp.com.mx",
  password: "Purp2023@",
  role: "manager",
  name: "Manager",
  permissions: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function upsertUser(db: any) {
  try {
    // Se crea un índice por email para acelerar las búsquedas; si ya existe se ignora el error
    await db.createIndex({ index: { fields: ["email"] } }).catch(() => {});
    // Consultamos si ya hay un usuario con el mismo correo
    const result = await db.find({ selector: { email: defaultUser.email }, limit: 1 });
    if (result.docs.length > 0) {
      console.log(`✅ El usuario ya existe en ${db.name}:`, (result.docs[0] as User).email);
      return;
    }
    // Si no existe, insertamos el documento con el _id especificado
    await db.put({ _id: defaultUser.id, ...defaultUser });
    console.log(`✅ Usuario creado exitosamente en ${db.name}.`);
  } catch (error) {
    // Cualquier fallo durante la inserción o la búsqueda se registra en consola
    console.error(`❌ Error al crear el usuario en ${db.name}:`, error);
  }
}

export async function createUserIfNotExists() {
  // Primero verificamos la base de datos local
  await upsertUser(localDB);
  try {
    // Intentamos repetir el proceso en la base remota; si falla
    // (por ejemplo sin conexión) simplemente lo ignoramos
    await upsertUser(remoteDB);
  } catch {}
}

if (require.main === module) {
  createUserIfNotExists();
}
