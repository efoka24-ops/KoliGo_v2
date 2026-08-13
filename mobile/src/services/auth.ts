import { storage } from '../utils/storage';
import { api } from './api';

export const authService = {
  async signup(payload: { name: string; phone: string; email?: string; pin: string; role: string; gender?: string; shopName?: string }) {
    const { data } = await api.post('/auth/signup', payload);
    // Persist both tokens, as signin does. Without the refresh token the
    // session dies the moment the 15-minute access token expires.
    await storage.setItem('access_token', data.accessToken);
    await storage.setItem('refresh_token', data.refreshToken);
    await storage.setItem('user_phone', payload.phone);
    return data;
  },

  async sendOtp(phone: string, email?: string, name?: string) {
    const { data } = await api.post('/auth/otp/send', { phone, email, name });
    return data;
  },

  async verifyOtp(phone: string, code: string) {
    const { data } = await api.post('/auth/otp/verify', { phone, code });
    return data;
  },

  async signin(phone: string, pin: string) {
    const { data } = await api.post('/auth/signin', { phone, pin });
    await storage.setItem('access_token', data.accessToken);
    await storage.setItem('refresh_token', data.refreshToken);
    await storage.setItem('user_phone', phone);
    return data;
  },

  async switchRole(role: 'VENDOR' | 'DELIVERER') {
    const { data } = await api.post('/auth/switch-role', { role });
    await storage.setItem('access_token', data.accessToken);
    return data;
  },

  async logout() {
    await storage.deleteItem('access_token');
    await storage.deleteItem('refresh_token');
  },
};
