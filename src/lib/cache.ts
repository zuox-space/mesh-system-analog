// src/lib/cache.ts

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, Entry<any>>();

/**
 * Получить значение из кэша. Если истекло — вернуть null.
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Положить значение в кэш на ttlMs миллисекунд.
 */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Удалить ключ.
 */
export function cacheDelete(key: string): void {
  store.delete(key);
}

/**
 * Удалить все ключи, начинающиеся с префикса.
 * Например, cacheInvalidate("schedule:") уберёт всё расписание.
 */
export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Очистить весь кэш.
 */
export function cacheClear(): void {
  store.clear();
}

/**
 * Обёртка: если в кэше есть — вернуть, иначе выполнить fn и закэшировать.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}

// TTL-константы (в миллисекундах)
export const TTL = {
  SCHEDULE: 5 * 60 * 1000,       // 5 минут
  ROOMS: 60 * 60 * 1000,         // 1 час
  PLANS: 10 * 60 * 1000,         // 10 минут
  PLAN_DETAILS: 10 * 60 * 1000,  // 10 минут
  STUDENTS: 60 * 60 * 1000,      // 1 час
  ACADEMIC_YEAR: 24 * 60 * 60 * 1000, // 24 часа
};