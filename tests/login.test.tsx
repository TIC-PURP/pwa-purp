// Pruebas para el formulario de inicio de sesion
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { LoginForm } from "@/components/auth/login-form";
import { store } from "@/lib/store";

// Simulamos el router de Next.js para evitar navegacion real en las pruebas
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Reiniciamos el estado de autenticacion antes de cada prueba
beforeEach(() => {
  store.dispatch({ type: "auth/load/fulfilled", payload: { user: null, token: null } });
});

describe("LoginForm", () => {
  // Verifica que los campos de correo y contrasena estan presentes
  it("should render email and password inputs", () => {
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    );
    const correoLabel = /correo/i;
    const contrasenaMatcher = (content: string) => content.toLowerCase().includes("contrase");
    expect(screen.getByLabelText(correoLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(contrasenaMatcher)).toBeInTheDocument();
  });

  // Comprueba que se muestre un mensaje de error si se envia el formulario vacio
  it("should show error on empty submit", async () => {
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    );
    const submitName = (label: string) => label.toLowerCase().includes("iniciar");
    fireEvent.click(screen.getByRole("button", { name: submitName }));
    expect(await screen.findByText(/correo es requerido/i)).toBeInTheDocument();
  });
});
