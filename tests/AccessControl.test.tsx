// Pruebas para validar el acceso a la pagina principal segun el rol del usuario
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import Dashboard from "@/app/principal/page";
import { setUser } from "@/lib/store/authSlice";
import type { User } from "@/lib/types";

// Se mockea el enrutador de Next.js para impedir navegacion real
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

const BASE_USER: User = {
  id: "user_base",
  name: "Test User",
  email: "test@example.com",
  password: "secret",
  role: "manager",
  permissions: [],
  isActive: true,
  createdAt: "2023-01-01T00:00:00.000Z",
  updatedAt: "2023-01-01T00:00:00.000Z",
};

const makeUser = (overrides: Partial<User>): User => ({
  ...BASE_USER,
  ...overrides,
});

describe("Control de acceso por rol", () => {
  // Usuarios con rol manager deben ver el panel
  it("muestra el panel para el rol 'manager'", () => {
    const managerUser = makeUser({
      id: "user_manager",
      role: "manager",
    });
    store.dispatch(setUser(managerUser));
    store.dispatch({
      type: "auth/load/fulfilled",
      payload: { user: store.getState().auth.user, token: "token" },
    });

    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>,
    );

    expect(screen.getByText(/Panel de Control/)).toBeInTheDocument();
  });

  // Usuarios sin rol manager no deben verlo
  it("oculta el panel si el rol no es 'manager'", () => {
    const regularUser = makeUser({
      id: "user_regular",
      role: "user",
    });
    store.dispatch(setUser(regularUser));
    store.dispatch({
      type: "auth/load/fulfilled",
      payload: { user: store.getState().auth.user, token: "token" },
    });

    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>,
    );

    expect(screen.queryByText(/Panel de Control/)).not.toBeInTheDocument();
  });
});
