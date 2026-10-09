import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Notification reçue application ouverte : on l'affiche quand même.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('koligo', {
      name: 'KoliGo', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250],
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

/**
 * Autorise les notifications et enregistre le jeton FCM du téléphone sur le serveur.
 * Renvoie true si le push serveur est opérationnel pour ce téléphone ; sinon l'app retombe sur la relève (polling).
 */
export async function registerForPush(api) {
  try {
    if (!(await ensurePermission())) return false;
    const tok = await Notifications.getDevicePushTokenAsync();
    const value = typeof tok?.data === 'string' ? tok.data : null;
    if (!value) return false;
    await api('/user/profile', { method: 'PATCH', body: JSON.stringify({ expoPushToken: value }) });
    return true;
  } catch {
    // Firebase non configuré dans cette version de l'APK : pas de push, la relève prend le relais.
    return false;
  }
}

/** Notification locale (utilisée quand le push serveur n'est pas disponible). */
export async function showLocal(title, body, data) {
  try {
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: 'koligo', seconds: 1 } : null,
    });
  } catch { /* sans importance */ }
}
