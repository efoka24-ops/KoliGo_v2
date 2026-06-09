import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const KEY = (id: string) => `gps:${id}`;

export const geoService = {
  async write(deliveryId: string, lat: number, lng: number) {
    const payload = JSON.stringify({ lat, lng, ts: Date.now() });
    await redis.set(KEY(deliveryId), payload, 'EX', 30);
  },

  async read(deliveryId: string) {
    const raw = await redis.get(KEY(deliveryId));
    return raw ? JSON.parse(raw) : null;
  },
};
