import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { LoginForm } from "@/components/auth/login-form";
import { store } from "@/lib/store";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  store.dispatch({ type: "auth/load/fulfilled", payload: { user: null, token: null } });
});

describe("LoginForm", () => {
  it("should render email and password inputs", () => {
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    );
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

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
