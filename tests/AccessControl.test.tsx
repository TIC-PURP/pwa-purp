import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";
// The protected dashboard has been replaced by the principal page, which
// conditionally displays the admin panel only for managers.
import Principal from "@/app/principal/page";
import { setUser } from "@/lib/store/authSlice";

describe("Control de acceso por rol", () => {
  it("debe mostrar el panel de control solo al rol 'manager'", () => {
    // establecemos un usuario con rol manager y fechas requeridas para el tipo User
    store.dispatch(
      setUser({
        id: "user_1",
        name: "Test User",
        email: "test@example.com",
        role: "manager",
        permissions: ["read", "write", "delete", "manage_users"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    render(
      <Provider store={store}>
        <Principal />
      </Provider>,
    );

    // El panel de control sólo se muestra a los usuarios con rol "manager"
    expect(screen.getByText(/Panel de Control/i)).toBeInTheDocument();
  });

  it("no debe mostrar el panel de control si el rol no es 'manager'", () => {
    store.dispatch(
      setUser({
        id: "user_2",
        name: "Otro User",
        email: "otro@example.com",
        role: "user",
        permissions: ["read"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    render(
      <Provider store={store}>
        <Principal />
      </Provider>,
    );

    expect(screen.queryByText(/Panel de Control/i)).not.toBeInTheDocument();
  });
});
