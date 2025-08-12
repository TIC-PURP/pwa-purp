"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginOnlineToCouchDB, bootstrapAfterLogin } from "@/lib/database";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) Login contra Couch (guarda cookie)
      await loginOnlineToCouchDB(email, pass);

      // 2) Si el cache local está vacío o lo borraste, baja todo y enciende sync
      await bootstrapAfterLogin();

      toast.success("¡Bienvenido!");
      router.push("/principal");
    } catch (err: any) {
      toast.error(err?.message || "Credenciales inválidas");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {/* tus inputs */}
      <button disabled={loading} type="submit">
        {loading ? "Entrando..." : "Iniciar Sesión"}
      </button>
    </form>
  );
}
