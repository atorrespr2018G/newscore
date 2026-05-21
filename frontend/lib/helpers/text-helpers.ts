export function excerpt(text: string, maxChars: number): string {
  const cleaned = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

