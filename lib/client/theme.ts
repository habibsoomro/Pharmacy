/**
 * Printing and PDFs always use the light theme (dark pages waste ink and look odd on paper).
 * Runs `fn` with the light theme on, then puts the person's theme back.
 */
export async function withLightTheme<T>(fn: () => Promise<T>): Promise<T> {
  const html = document.documentElement;
  const before = html.dataset.theme;
  html.dataset.theme = "light";
  try {
    return await fn();
  } finally {
    if (before) html.dataset.theme = before;
  }
}
