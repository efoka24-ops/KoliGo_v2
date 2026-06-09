import axios from 'axios';
import { storage } from '../utils/storage';

export const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'   // Android emulator → host machine
  : 'https://api.koligo.cm';

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
