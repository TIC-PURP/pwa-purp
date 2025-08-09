"use client";

import { useForm } from "react-hook-form";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loginUser } from "@/lib/store/authSlice";
import { useState } from "react";

type FormValues = { email: string; password: string };

export function LoginForm() {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((s) => s.auth);
  const { register, handleSubmit } = useForm<FormValues>();
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (data: FormValues) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setInfo("Sin conexión: intentando login offline…");
    } else {
      setInfo(null);
    }
    await dispatch(loginUser(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          type="email"
          autoComplete="email"
          {...register("email", { required: true })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Contraseña</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          type="password"
          autoComplete="current-password"
          {...register("password", { required: true })}
        />
      </div>

      {info && <p className="text-sm text-slate-600">{info}</p>}
      {error && <p className="text-sm text-red-600">{String(error)}</p>}

      <button
        type="submit"
        className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}

// Export default too, to avoid import issues
export default LoginForm;