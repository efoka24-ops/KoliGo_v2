import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { API_BASE } from '../config';

export const BACKGROUND_LOCATION_TASK = 'KOLIGO_BACKGROUND_LOCATION';

// Register the background task — must be called at the top level (not inside a component)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const { latitude, longitude } = data.locations[0].coords;
  const deliveryId = global.__kgActiveDeliveryId;
  const token = global.__kgToken;
  if (!deliveryId || !token) return;
  try {
    await fetch(`${API_BASE}/deliveries/${deliveryId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: latitude, lng: longitude }),
    });
  } catch {}
});

export async function startBackgroundTracking(deliveryId, token) {
  global.__kgActiveDeliveryId = deliveryId;
  global.__kgToken = token;
  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') return false;
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  if (running) return true;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'KoliGo — Livraison en cours',
      notificationBody: 'Votre position GPS est partagée avec le vendeur.',
      notificationColor: '#0D7A3E',
    },
  });
  return true;
}

export async function stopBackgroundTracking() {
  global.__kgActiveDeliveryId = null;
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
