import { storage } from '../utils/storage';
import { api } from './api';

export const authService = {
  async signup(payload: { name: string; phone: string; pin: string; role: string }) {
    const { data } = await api.post('/auth/signup', payload);
    return data;
  },

  async sendOtp(phone: string, channel: 'sms' | 'whatsapp' = 'sms') {
    const { data } = await api.post('/auth/otp/send', { phone, channel });
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
