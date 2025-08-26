// Pruebas para el formulario de inicio de sesión
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { LoginForm } from "@/components/auth/login-form";
import { store } from "@/lib/store";

// Simulamos el router de Next.js para evitar navegación real en las pruebas
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Reiniciamos el estado de autenticación antes de cada prueba
beforeEach(() => {
  store.dispatch({ type: "auth/load/fulfilled", payload: { user: null, token: null } });
});

describe("LoginForm", () => {
  // Verifica que los campos de correo y contraseña estén presentes
  it("should render email and password inputs", () => {
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    );
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  // Comprueba que se muestre un mensaje de error si se envía el formulario vacío
  it("should show error on empty submit", async () => {
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(await screen.findByText(/correo es requerido/i)).toBeInTheDocument();
  });
});
