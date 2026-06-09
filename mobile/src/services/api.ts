import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'   // Android emulator → host machine
  : 'https://api.koligo.cm';

export const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (refresh) {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { token: refresh });
        await SecureStore.setItemAsync('access_token', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);
