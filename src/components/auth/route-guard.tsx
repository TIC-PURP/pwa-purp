// src/components/auth/route-guard.tsx
"use client";

import { useSelector } from "react-redux";
import { selectAuth } from "@/lib/store/authSlice";
import LoginForm from "@/components/auth/login-form";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useSelector(selectAuth);
  if (!auth.user) return <LoginForm />;
  return <>{children}</>;
}
