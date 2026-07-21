/**
 * Cache de resultados de /aggregate, en memoria del proceso. LRU simple con
 * el orden de insercion de un Map (delete+set mueve una entrada al final);
 * sin libreria, es lo que hace falta para un solo proceso.
 * ponytail: tope fijo de entradas, no por tamaño en bytes -- si algun dia el
 * cache se vuelve un problema de memoria real, medir antes de complicar esto.
 */
const MAX_ENTRIES = 100;

const cache = new Map<string, unknown>();

export function getCachedAggregate(key: string): unknown | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value); // mas reciente -> al final
  return value;
}

export function setCachedAggregate(key: string, value: unknown): void {
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}
