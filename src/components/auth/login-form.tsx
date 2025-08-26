"use client";

// Formulario de inicio de sesión. Maneja la captura de credenciales del
// usuario, la validación mediante Zod y el dispatch de la acción de login.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loginUser } from "@/lib/store/authSlice";
import { loginSchema, type LoginSchema } from "@/lib/validations";

export function LoginForm() {
  // Controla si se muestra la contraseña en texto plano o no
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading } = useAppSelector((state) => state.auth);

  // Configuramos React Hook Form con Zod para validar los campos
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  // Función que se ejecuta cuando el usuario envía el formulario
  const onSubmit = async (data: LoginSchema) => {
    try {
      const result = await dispatch(loginUser(data));
      if (loginUser.fulfilled.match(result)) {
        // Autenticación exitosa → redirigimos al panel principal
        router.push("/principal");
      } else if (loginUser.rejected.match(result)) {
        // Error controlado desde el thunk
        const message =
          (result.payload as string) ||
          result.error.message ||
          "Credenciales inválidas";
        setError("root", { message });
        console.error("Error de login:", message);
      }
    } catch (error: any) {
      // Error inesperado (por ejemplo, fallo de red)
      const message = error?.message || "Error de conexión";
      setError("root", { message });
      console.error("Error de login:", message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Iniiciar Sesión
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Formulario controlado por React Hook Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo de correo electrónico */}
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email"
                  className="pl-10"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Campo de contraseña con botón para mostrar/ocultar */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Mensaje de error general */}
            {errors.root && (
              <p className="text-sm text-red-600 text-center">
                {errors.root.message}
              </p>
            )}

            {/* Botón de envío del formulario */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
