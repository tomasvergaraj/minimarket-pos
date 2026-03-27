/**
 * Almacenamiento sincrónico sobre AsyncStorage.
 * Mantiene un caché en memoria para lecturas síncronas (requeridas por el
 * interceptor de Axios). La escritura persiste en AsyncStorage de fondo.
 *
 * Uso: llamar Storage.hydrate([...keys]) al arrancar la app antes de renderizar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const cache = new Map<string, string>()

export const Storage = {
  /** Lee del caché en memoria (sync). Solo disponible tras hydrate(). */
  get<T>(key: string): T | null {
    const v = cache.get(key)
    if (!v) return null
    try { return JSON.parse(v) as T } catch { return null }
  },

  /** Escribe en caché (sync) y persiste en AsyncStorage (async, best-effort). */
  set<T>(key: string, value: T): void {
    const s = JSON.stringify(value)
    cache.set(key, s)
    AsyncStorage.setItem(key, s).catch(() => {})
  },

  /** Elimina del caché y de AsyncStorage. */
  remove(key: string): void {
    cache.delete(key)
    AsyncStorage.removeItem(key).catch(() => {})
  },

  /** Precarga las claves desde AsyncStorage al caché en memoria. */
  async hydrate(keys: string[]): Promise<void> {
    try {
      const pairs = await AsyncStorage.multiGet(keys)
      for (const [k, v] of pairs) {
        if (v !== null) cache.set(k, v)
      }
    } catch {}
  },
}
