import DOMPurify from "dompurify";

// Sanitiza cadenas HTML para prevenir XSS
export function sanitize(input: string): string {
  return DOMPurify.sanitize(input);
}
