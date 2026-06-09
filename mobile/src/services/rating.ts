import { api } from './api';

export const ratingService = {
  async post(deliveryId: string, score: number, tags: string[], comment?: string) {
    const { data } = await api.post('/ratings', { deliveryId, score, tags, comment });
    return data;
  },
};
