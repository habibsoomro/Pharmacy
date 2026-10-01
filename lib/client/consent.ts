const KEY = "nuskha:consent:v1"; // change v1 → v2 if the consent wording changes, so people are asked again

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

export function saveConsent(value: boolean) {
  try {
    if (value) localStorage.setItem(KEY, "yes");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
