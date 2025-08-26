import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combina clases de Tailwind evitando duplicados
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
