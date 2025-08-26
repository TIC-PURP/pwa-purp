// Página de login: simplemente renderiza el formulario de autenticación.
// Mantener esta página ligera permite reutilizar el formulario en otros
// contextos (por ejemplo, en modo offline dentro del `RouteGuard`).

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  // Renderiza el componente responsable del proceso de inicio de sesión
  return <LoginForm />;
}
