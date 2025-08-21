export const dynamic = "force-dynamic";
export const revalidate = 0;

import LoginForm from "@/components/auth/login-form";
import { Navbar } from "@/components/layout/navbar";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-10 px-4">
        <LoginForm />
      </main>
    </div>
  );
}
