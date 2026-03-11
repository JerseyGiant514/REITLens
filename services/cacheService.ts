import { supabase } from './supabaseClient';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_PREFIX = 'reitlens_cache_';

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    
    const memEntry = memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > now) {
      return memEntry.value as T;
    }
    
    try {
      const localItem = localStorage.getItem(CACHE_PREFIX + key);
      if (localItem) {
        const parsed = JSON.parse(localItem);
        if (parsed.expiresAt > now) {
          memoryCache.set(key, parsed);
          return parsed.value as T;
        }
      }
    } catch (e) {
      // localStorage cache miss
    }
    
    try {
      const { data, error } = await supabase
        .from('data_cache')
        .select('cache_value, expires_at')
        .eq('cache_key', key)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (data && !error) {
        const value = data.cache_value as T;
        const expiresAt = new Date(data.expires_at).getTime();
        memoryCache.set(key, { value, expiresAt });
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiresAt }));
        return value;
      }
    } catch (e) {
      // Supabase cache miss
    }
    
    return null;
  }

  static async set<T>(key: string, value: T, ttlMinutes: number = 60): Promise<void> {
    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);
    const expiresAtISO = new Date(expiresAt).toISOString();
    
    memoryCache.set(key, { value, expiresAt });
    
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiresAt }));
    } catch (e) {
      // localStorage set failed
    }
    
    try {
      await supabase.from('data_cache').upsert({
        cache_key: key,
        cache_value: value as any,
        expires_at: expiresAtISO,
        hit_count: 0
      });
    } catch (e) {
      // Supabase cache set failed
    }
  }

  static clearMemory(): void {
    memoryCache.clear();
  }
}
