/** Acesso seguro ao localStorage (indisponível em alguns contextos). */
export const BrowserStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignora: só perde a persistência */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignora */
    }
  },
};
