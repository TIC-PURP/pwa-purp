import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import ModuleBPage from "@/app/mod-b/page.client";
import authReducer, { type AuthState } from "@/lib/store/authSlice";
import type { User } from "@/lib/types";
import { listPhotos } from "@/lib/database";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("@/components/layout/navbar", () => ({
  Navbar: () => <nav data-testid="navbar-mock" />,
}));

jest.mock("@/components/common/back-button", () => () => <button type="button">Regresar</button>);

jest.mock("@/lib/database", () => ({
  listPhotos: jest.fn().mockResolvedValue([
    { _id: "photo:1", createdAt: "2024-01-01T00:00:00.000Z" },
  ]),
  savePhoto: jest.fn().mockResolvedValue({ ok: true, _id: "photo:1" }),
  getPhotoThumbUrl: jest.fn().mockImplementation(async (id: string) => `blob:${id}`),
  deletePhoto: jest.fn().mockResolvedValue({ ok: true }),
}));

const baseAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function renderWithUser(user: User | null) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        ...baseAuthState,
        user,
        isAuthenticated: Boolean(user),
        token: user ? "token" : null,
      },
    },
  });

  return render(
    <Provider store={store}>
      <ModuleBPage />
    </Provider>,
  );
}

beforeAll(() => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

beforeEach(() => {
  replaceMock.mockClear();
  (listPhotos as jest.Mock).mockClear();
});

test("renders Module B when user has full access", async () => {
  const manager: User = {
    id: "user_manager",
    name: "Gerente",
    email: "gerente@example.com",
    password: "secret",
    role: "manager",
    permissions: [],
    modulePermissions: {
      MOD_A: "FULL",
      MOD_B: "FULL",
      MOD_C: "FULL",
      MOD_D: "FULL",
    },
    isActive: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  renderWithUser(manager);

  expect(await screen.findByText("Modulo B")).toBeInTheDocument();
  expect(screen.getByTestId("navbar-mock")).toBeInTheDocument();
  await waitFor(() => expect(listPhotos).toHaveBeenCalledWith({ owner: manager.id }));
});

test("redirects away when module access is NONE", async () => {
  const limited: User = {
    id: "user_limited",
    name: "Usuario Limitado",
    email: "limitado@example.com",
    password: "secret",
    role: "user",
    permissions: [],
    modulePermissions: {
      MOD_A: "READ",
      MOD_B: "NONE",
      MOD_C: "NONE",
      MOD_D: "NONE",
    },
    isActive: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  renderWithUser(limited);

  await waitFor(() => {
    expect(replaceMock).toHaveBeenCalledWith("/principal");
  });
  expect(screen.queryByText("Modulo B")).not.toBeInTheDocument();
});

