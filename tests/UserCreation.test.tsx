import { createUser, getAllUsers } from "@/lib/database";
import type { CreateUserData } from "@/lib/types";

describe("Creación de usuarios", () => {
  it("crea un usuario y lo recupera de la base de datos local", async () => {
    // define únicamente los campos requeridos para crear un usuario
    const newUser: CreateUserData = {
      name: "Nuevo Usuario",
      email: "nuevo@purp.com.mx",
      password: "Test123!",
      role: "user",
      permissions: ["read"],
    };

    await createUser(newUser);
    const users = await getAllUsers();
    const found = users.find((u) => u.email === "nuevo@purp.com.mx");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Nuevo Usuario");
  });
});
