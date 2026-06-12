import Redis from 'ioredis';

// Redis is optional — GPS streaming degrades gracefully if unavailable
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  redis.on('error', () => {}); // silence connection noise
} catch {
  redis = null;
}

const KEY = (id: string) => `gps:${id}`;

export const geoService = {
  async write(deliveryId: string, lat: number, lng: number) {
    if (!redis) return;
    try {
      const payload = JSON.stringify({ lat, lng, ts: Date.now() });
      await redis.set(KEY(deliveryId), payload, 'EX', 30);
    } catch {}
  },

  async read(deliveryId: string) {
    if (!redis) return null;
    try {
      const raw = await redis.get(KEY(deliveryId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
