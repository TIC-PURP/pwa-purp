"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDispatch } from "react-redux";
import { loginSchema } from "@/lib/validations";
import { loginSuccess } from "@/lib/store/authSlice";
import { loginOnline } from "@/lib/auth/login";
import { loginOffline } from "@/lib/auth/offline";
import { useState } from "react";

export default function LoginForm() {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: any) => {
    try {
      const onlineUser = await loginOnline(data);
      dispatch(loginSuccess(onlineUser));
    } catch (err) {
      console.warn("Fallo login online, intentando offline:", err);
      try {
        const offlineUser = await loginOffline(data);
        dispatch(loginSuccess(offlineUser));
      } catch (offlineErr) {
        setError("Credenciales inválidas o no disponibles offline.");
        console.error("Error en login offline:", offlineErr);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input {...register("email")} placeholder="Correo" />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register("password")} placeholder="Contraseña" />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit">Ingresar</button>

      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
