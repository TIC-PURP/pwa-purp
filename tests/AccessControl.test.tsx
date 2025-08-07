import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
import Dashboard from "@/app/(protected)/dashboard/page";
import { setUser } from "@/lib/store/authSlice";

describe("Control de acceso por rol", () => {
  it("debe mostrar el dashboard solo al rol 'manager'", () => {
    store.dispatch(setUser({
      id: "user_1",
      name: "Test User",
      email: "test@example.com",
      role: "manager",
      permissions: [],
      isActive: true,
    }));

    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>
    );

    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
  });

  it("no debe mostrar el dashboard si el rol no es 'manager'", () => {
    store.dispatch(setUser({
      id: "user_2",
      name: "Otro User",
      email: "otro@example.com",
      role: "user",
      permissions: [],
      isActive: true,
    }));

    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>
    );

    expect(screen.queryByText("Bienvenido")).not.toBeInTheDocument();
  });
});