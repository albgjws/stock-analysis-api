import fs from 'fs/promises';
import path from 'path';
import NodeCache from 'node-cache';
import { config } from '../config';
import type { CacheEntry } from '../types';

export class CacheService {
  private memoryCache: NodeCache;

  constructor() {
    this.memoryCache = new NodeCache({
      stdTTL: config.inMemoryTTLSec,
      checkperiod: 120,
    });
  }

  async get<T>(key: string, allowStale = false): Promise<T | null> {
    // 1. Check memory cache first
    const memCached = this.memoryCache.get<T>(key);
    if (memCached !== undefined) return memCached;

    // 2. Check file cache
    try {
      const filePath = this.getFilePath(key);
      const raw = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;

      if (age < entry.ttl) {
        // Still fresh — also promote to memory cache
        this.memoryCache.set(key, entry.data);
        return entry.data;
      }

      // Expired — if allowStale is true, return stale data as fallback
      if (allowStale) {
        console.log(`[Cache] Returning stale data for key: ${key}`);
        this.memoryCache.set(key, entry.data);
        return entry.data;
      }

      // Expired and not allowed to return stale
      return null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    // 1. Write to memory cache
    this.memoryCache.set(key, data);

    // 2. Write to file cache (atomic: write temp then rename)
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    const filePath = this.getFilePath(key);
    const tmpPath = filePath + '.tmp';

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmpPath, JSON.stringify(entry), 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      console.error(`[Cache] Failed to write cache file: ${key}`, err);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.flushAll();

    try {
      const files = await fs.readdir(config.cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      await Promise.all(
        jsonFiles.map(f => fs.unlink(path.join(config.cacheDir, f)).catch(() => {}))
      );
    } catch {
      // directory might not exist
    }
  }

  getStats(): { memoryKeys: number; cacheDir: string } {
    return {
      memoryKeys: this.memoryCache.keys().length,
      cacheDir: config.cacheDir,
    };
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    return path.join(config.cacheDir, `${safeKey}.json`);
  }
}