/**
 * AI SETTINGS: change the model here and it changes everywhere.
 * Used only on the server (API routes). The API key is read from
 * process.env.ANTHROPIC_API_KEY and is never sent to the browser.
 */
export const AI_MODEL = "claude-sonnet-5-5";

// Maximum length of each AI answer (in tokens). Extraction JSON can be long.
export const AI_MAX_TOKENS = {
  extract: 4000,
  interactions: 3000,
  translate: 4000,
} as const;
