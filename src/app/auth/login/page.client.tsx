// Página de inicio de sesión: renderiza el formulario principal de autenticación.
// Mantener esta pantalla ligera permite reutilizar el formulario en otros
// contextos (por ejemplo, en modo sin conexión dentro del `RouteGuard`).

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  // Renderiza el componente responsable de gestionar el proceso de inicio de sesión.
  return <LoginForm />;
}

