import axios from 'axios';
import { storage } from '../utils/storage';

export const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'   // Android emulator → host machine
  : 'https://koligoapi.trugroup.cm';

export const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await storage.getItem('refresh_token');
      if (refresh) {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { token: refresh });
        await storage.setItem('access_token', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);

// Maps backend Delivery model fields to the flat UI shape expected by screens
export function normalizeDelivery(d: any) {
  if (!d) return d;
  const statusMap: Record<string, string> = {
    EN_ATTENTE: 'en_attente', ACCEPTE: 'accepte', EN_ROUTE: 'en_route', LIVRE: 'livre',
  };
  const typeMap: Record<string, string> = {
    TEMPORAIRE: 'temporaire', PERMANENT: 'permanent', EXPRESS: 'express', VVIP: 'vvip',
  };
  return {
    id: d.id,
    from: d.pickupAddress ?? d.from,
    to: d.dropoffAddress ?? d.to,
    weight: d.weightKg ?? d.weight,
    type: typeMap[d.delivererType] ?? d.delivererType?.toLowerCase() ?? d.type ?? 'temporaire',
    status: statusMap[d.status] ?? d.status?.toLowerCase() ?? 'en_attente',
    price: d.priceXAF ?? d.price ?? 0,
    code: d.deliverCode ?? d.code,
    collectCode: d.collectCode,
    recipient: d.recipientName ?? d.recipient ?? null,
    recipientId: d.recipientId ?? null,
    vendor: d.vendor?.name ?? d.vendorName ?? d.vendor ?? null,
    vendorRating: d.vendor?.rating ?? d.vendorRating ?? null,
    delivererEarning: d.delivererEarning ?? null,
    distance: d.distanceKm ?? d.distance ?? null,
    description: d.description ?? null,
    time: d.createdAt
      ? new Date(d.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : (d.time ?? null),
    posted: d.posted ?? null,
    momoRef: d.momoRef ?? null,
    convIdDeliverer: d.convIdDeliverer ?? null,
    convIdClient: d.convIdClient ?? null,
  };
}

// Compatibility shim for prototype screens that call apiFetch(path, options?, token?)
export async function apiFetch(path: string, options: RequestInit = {}, token?: string | null): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await axios({
      url: `${BASE_URL}${path}`,
      method: (options.method as any) || 'GET',
      headers,
      data: options.body,
    });
    return res.data;
  } catch (e: any) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}
