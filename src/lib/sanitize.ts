import DOMPurify from 'dompurify'

export function sanitize(input: string): string {
  return DOMPurify.sanitize(input)
}
