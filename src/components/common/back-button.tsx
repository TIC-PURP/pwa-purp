"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftCircle } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center text-muted-foreground hover:text-foreground transition text-sm"
      aria-label="Regresar"
      type="button"
   >
      <ArrowLeftCircle className="h-5 w-5 mr-2" />
      <span>Regresar</span>
    </button>
  );
}
