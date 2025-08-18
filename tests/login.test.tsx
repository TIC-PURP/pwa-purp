import { render, screen, fireEvent } from "@testing-library/react";
// The login form component lives under the auth folder and exposes a named export
import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm", () => {
  it("renders email and password inputs", () => {
    render(<LoginForm />);
    // the labels are in Spanish, but using case‐insensitive regex will match them
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    render(<LoginForm />);
    // trigger submit on the single button in the form
    fireEvent.click(screen.getByRole("button"));
    // the zod resolver will surface user‑friendly Spanish error messages.  Check for one of them.
    expect(
      await screen.findByText(/debe tener al menos/i),
    ).toBeInTheDocument();
  });
});
