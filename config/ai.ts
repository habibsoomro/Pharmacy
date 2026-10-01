/**
 * AI SETTINGS: change the model here and it changes everywhere.
 * Used only on the server (API routes). The API key is read from
 * process.env.ANTHROPIC_API_KEY and is never sent to the browser.
 */
export const AI_MODEL = "claude-sonnet-5-5";

// Maximum length of each AI answer (in tokens). Prescriptions with many medicines need room.
export const AI_MAX_TOKENS = {
  extract: 8000,
  interactions: 3000,
  translate: 4000,
} as const;

// 0 = most consistent answers (best for reading prescriptions).
// If the API ever says temperature isn't supported for this model, the app retries without it.
export const AI_TEMPERATURE: number | null = 0;

// Give up waiting for the AI after this many seconds.
export const AI_TIMEOUT_SECONDS = 55;
