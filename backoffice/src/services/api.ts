import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = __DEV__ ? 'http://10.0.2.2:3000' : 'https://koligoapi.trugroup.cm';

export const adminApi = axios.create({ baseURL: BASE_URL, timeout: 15000 });

adminApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const adminService = {
  async login(phone: string, pin: string) {
    const { data } = await adminApi.post('/auth/signin', { phone, pin });
    await SecureStore.setItemAsync('admin_token', data.accessToken);
    return data;
  },

  async getStats() {
    const { data } = await adminApi.get('/admin/stats');
    return data;
  },

  async listUsers(q?: string, page = 1) {
    const { data } = await adminApi.get('/admin/users', { params: { q, page } });
    return data;
  },

  async reviewKyc(userId: string, status: 'VERIFIED' | 'REJECTED') {
    const { data } = await adminApi.patch(`/admin/users/${userId}/kyc`, { status });
    return data;
  },

  async blockUser(userId: string, blocked: boolean) {
    const { data } = await adminApi.patch(`/admin/users/${userId}/block`, { blocked });
    return data;
  },

  async listDeliveries(status?: string, page = 1) {
    const { data } = await adminApi.get('/admin/deliveries', { params: { status, page } });
    return data;
  },

  async cancelDelivery(id: string) {
    const { data } = await adminApi.patch(`/admin/deliveries/${id}/cancel`);
    return data;
  },

  async getSettings() {
    const { data } = await adminApi.get('/admin/settings');
    return data;
  },

  async updateSetting(key: string, value: string) {
    const { data } = await adminApi.patch('/admin/settings', { key, value });
    return data;
  },
};
