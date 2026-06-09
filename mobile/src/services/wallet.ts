import { api } from './api';

export const walletService = {
  async getBalance() {
    const { data } = await api.get('/wallet');
    return data;
  },

  async getTransactions(params?: { page?: number; limit?: number }) {
    const { data } = await api.get('/wallet/transactions', { params });
    return data;
  },

  async withdraw(amountXAF: number, provider: 'MTN' | 'ORANGE', phoneNumber: string) {
    const { data } = await api.post('/wallet/withdraw', { amountXAF, provider, phoneNumber });
    return data;
  },
};
