import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import Dashboard from "@/app/principal/page";
import { setUser } from "@/lib/store/authSlice";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

describe("Control de acceso por rol", () => {
  it("muestra el panel para el rol 'manager'", () => {
    store.dispatch(
      setUser({
        id: "user_1",
        name: "Test User",
        email: "test@example.com",
        role: "manager",
        permissions: [],
        isActive: true,
      }),
    );
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

  it("oculta el panel si el rol no es 'manager'", () => {
    store.dispatch(
      setUser({
        id: "user_2",
        name: "Otro User",
        email: "otro@example.com",
        role: "user",
        permissions: [],
        isActive: true,
      }),
    );
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
