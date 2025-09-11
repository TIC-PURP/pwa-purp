import { canSeeModuleA, canSeeModuleB, canSeeModuleC, canSeeModuleD, moduleAMode, moduleBMode, moduleCMode, moduleDMode } from "@/lib/permissions";

const baseUser = {
  id: "u1",
  name: "User",
  email: "u@example.com",
  password: "x",
  role: "user" as const,
  permissions: [],
  isActive: true,
  createdAt: "now",
  updatedAt: "now",
};

describe("permissions helpers", () => {
  it("returns NONE/false when modulePermissions missing", () => {
    const user: any = { ...baseUser, modulePermissions: undefined };
    expect(moduleAMode(user)).toBe("NONE");
    expect(moduleBMode(user)).toBe("NONE");
    expect(moduleCMode(user)).toBe("NONE");
    expect(moduleDMode(user)).toBe("NONE");
    expect(canSeeModuleA(user)).toBe(false);
    expect(canSeeModuleB(user)).toBe(false);
    expect(canSeeModuleC(user)).toBe(false);
    expect(canSeeModuleD(user)).toBe(false);
  });

  it("honors READ as visible and FULL as visible", () => {
    const user: any = { ...baseUser, modulePermissions: { MOD_A: "READ", MOD_B: "FULL", MOD_C: "NONE", MOD_D: "NONE" } };
    expect(moduleAMode(user)).toBe("READ");
    expect(moduleBMode(user)).toBe("FULL");
    expect(canSeeModuleA(user)).toBe(true);
    expect(canSeeModuleB(user)).toBe(true);
    expect(canSeeModuleC(user)).toBe(false);
  });

  it("manager always FULL for all modules", () => {
    const user: any = { ...baseUser, role: "manager", modulePermissions: { MOD_A: "NONE", MOD_B: "NONE" } };
    expect(moduleAMode(user)).toBe("FULL");
    expect(moduleBMode(user)).toBe("FULL");
    expect(moduleCMode(user)).toBe("FULL");
    expect(moduleDMode(user)).toBe("FULL");
    expect(canSeeModuleD(user)).toBe(true);
  });
});

