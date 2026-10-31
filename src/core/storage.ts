// localStorage for settings this browser keeps. It never throws: in private modes or with storage full, reads come
// back empty and writes last only as long as the page.

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* not kept */
  }
}

/** The parsed value, or null when it is missing or not JSON. */
export function getJson(key: string): unknown {
  const raw = getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export const setJson = (key: string, value: unknown): void => setItem(key, JSON.stringify(value));
