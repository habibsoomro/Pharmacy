import { go, useAppState } from "../store";

/** Stand-in for next/navigation's router: push/replace switch the page; refresh has nothing to reload. */
const router = { push: go, replace: go, refresh: () => {}, back: () => history.back(), forward: () => history.forward(), prefetch: () => {} };
export function useRouter() {
  return router;
}

export function usePathname(): string {
  return useAppState().page;
}
