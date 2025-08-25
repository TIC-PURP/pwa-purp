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
  name: "Mario Acosta",
  permissions: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function upsertUser(db: any) {
  try {
    await db.createIndex({ index: { fields: ["email"] } }).catch(() => {});
    const result = await db.find({ selector: { email: defaultUser.email }, limit: 1 });
    if (result.docs.length > 0) {
      console.log(`✅ El usuario ya existe en ${db.name}:`, (result.docs[0] as User).email);
      return;
    }
    await db.put({ _id: defaultUser.id, ...defaultUser });
    console.log(`✅ Usuario creado exitosamente en ${db.name}.`);
  } catch (error) {
    console.error(`❌ Error al crear el usuario en ${db.name}:`, error);
  }
}

export async function createUserIfNotExists() {
  await upsertUser(localDB);
  try {
    await upsertUser(remoteDB);
  } catch {}
}

if (require.main === module) {
  createUserIfNotExists();
}
