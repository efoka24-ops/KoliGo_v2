import { api } from './api';

export type DeliveryStatus = 'EN_ATTENTE' | 'ACCEPTE' | 'EN_ROUTE' | 'LIVRE' | 'ANNULE';

export const deliveryService = {
  async create(payload: {
    pickupAddress: string;
    dropoffAddress: string;
    weightKg: number;
    description?: string;
    delivererType: string;
  }) {
    const { data } = await api.post('/deliveries', payload);
    return data;
  },

  async list(params?: { status?: DeliveryStatus; page?: number }) {
    const { data } = await api.get('/deliveries', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/deliveries/${id}`);
    return data;
  },

  async accept(id: string) {
    const { data } = await api.patch(`/deliveries/${id}/accept`);
    return data;
  },

  async cancel(id: string) {
    const { data } = await api.patch(`/deliveries/${id}/cancel`);
    return data;
  },

  async confirmCollect(id: string, collectCode: string) {
    const { data } = await api.patch(`/deliveries/${id}/confirm-collect`, { collectCode });
    return data;
  },

  async confirmDeliver(id: string, deliverCode: string, momoRef?: string) {
    const { data } = await api.patch(`/deliveries/${id}/confirm-deliver`, { deliverCode, momoRef });
    return data;
  },

  async postLocation(id: string, latitude: number, longitude: number) {
    await api.post(`/deliveries/${id}/location`, { latitude, longitude });
  },

  async getLocation(id: string) {
    const { data } = await api.get(`/deliveries/${id}/location`);
    return data;
  },

  async getByClientToken(token: string) {
    const { data } = await api.get(`/deliveries/track/${token}`);
    return data;
  },
};
