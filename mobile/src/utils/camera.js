import * as ImagePicker from 'expo-image-picker';

/**
 * Ouvre l'appareil photo et renvoie la photo en data URI JPEG.
 *
 * Résultat : { status: 'ok', uri, dataUrl } | { status: 'cancelled' } | { status: 'denied', message } | { status: 'error', message }
 * Ne lève jamais d'exception : l'écran affiche le message au lieu de rester muet.
 *
 * Attention : avec Expo SDK 51 (expo-image-picker 15), `mediaTypes` doit valoir
 * ImagePicker.MediaTypeOptions.Images ("Images"). La forme minuscule 'images' est celle de
 * SDK 52+ : sur cette version l'appel natif est rejeté et la caméra ne s'ouvre pas.
 */
export async function capturePhoto({ quality = 0.7, front = false } = {}) {
  try {
    let perm = await ImagePicker.getCameraPermissionsAsync();
    if (!perm.granted) perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return {
        status: 'denied',
        message: perm.canAskAgain === false
          ? "L'accès à la caméra est bloqué. Ouvrez Réglages > Applications > KoliGo > Autorisations et activez la caméra."
          : "L'accès à la caméra est nécessaire pour prendre la photo.",
      };
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality,
      base64: true,
      allowsEditing: false,
      cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (result.canceled) return { status: 'cancelled' };
    const asset = result.assets?.[0];
    if (!asset?.base64) return { status: 'error', message: "La photo n'a pas pu être lue. Réessayez." };
    return { status: 'ok', uri: asset.uri, dataUrl: `data:image/jpeg;base64,${asset.base64}` };
  } catch (e) {
    return { status: 'error', message: `Impossible d'ouvrir la caméra (${e?.message || 'erreur inconnue'}).` };
  }
}
