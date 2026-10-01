/** The page's link to Claude's viewer (window.claude), typed loosely. Absent outside Claude. */
type Use = (name: string) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useCapability<T = any>(name: string): Promise<T | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const claude = (window as unknown as { claude?: { use?: Use } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return claude.use(name).catch(() => null);
}
