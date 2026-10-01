/** Fill {placeholders} in translated text: fmt("Page {n}", { n: 2 }) → "Page 2". */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
