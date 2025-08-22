import { createUser, getAllUsers } from "@/lib/database";
import { User } from "@/lib/types";

describe("Creación de usuarios", () => {
  it("crea un usuario y lo recupera de la base de datos local", async () => {
    const newUser: User = {
      id: "",
      _id: "",
      name: "Nuevo Usuario",
      email: "nuevo@purp.com.mx",
      password: "Test123!",
      role: "user",
      permissions: ["read"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createUser(newUser);
    const users = await getAllUsers();
    const found = users.find((u) => u.email === "nuevo@purp.com.mx");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Nuevo Usuario");
  });
});
