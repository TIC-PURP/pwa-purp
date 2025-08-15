// src/components/ClientRoot.tsx
"use client";

import type React from "react";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InstallButton from "@/components/InstallButton";

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Providers>
        <ErrorBoundary>{children}</ErrorBoundary>
        <InstallButton />
      </Providers>
      <Toaster richColors position="top-center" />
    </>
  );
}
