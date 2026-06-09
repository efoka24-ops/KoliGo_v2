import * as Location from 'expo-location';
import { deliveryService } from './delivery';

let _interval: ReturnType<typeof setInterval> | null = null;

export const geoService = {
  async startStreaming(deliveryId: string) {
    if (_interval) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    _interval = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await deliveryService.postLocation(deliveryId, loc.coords.latitude, loc.coords.longitude);
    }, 8000);
  },

  stopStreaming() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  },
};
