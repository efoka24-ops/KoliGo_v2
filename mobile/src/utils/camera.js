import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Photos pour le KYC et les colis.
 *
 * Résultat de chaque fonction :
 *   { status: 'ok', uri, base64 } | { status: 'cancelled' } | { status: 'denied', message } | { status: 'error', message }
 * Aucune ne lève d'exception : l'écran affiche le message au lieu de rester muet.
 *
 * Points qui comptent avec Expo SDK 51 (expo-image-picker 15) :
 *  - `mediaTypes` doit valoir MediaTypeOptions.Images ("Images"). La forme 'images' est celle de SDK 52+ et est rejetée.
 *  - On n'impose pas la caméra avant : sur beaucoup de téléphones Android cela referme l'appli photo sans cliché.
 *    L'utilisateur bascule lui-même dans l'appli photo.
 *  - Android peut détruire l'activité pendant la prise de vue (peu de mémoire) : la promesse est alors perdue.
 *    recoverPendingPhoto() récupère la photo à la reprise de l'application.
 */
// base64 n'est pas demandé ici : une photo de 50 Mpx en base64 sature la mémoire. On la réduit d'abord.
const OPTIONS = (quality) => ({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality,
  base64: false,
  allowsEditing: false,
});

const MAX_WIDTH = 1280; // assez net pour lire une CNI, quelques centaines de Ko au lieu de plusieurs Mo

async function shrink(uri) {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_WIDTH } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  // base64 BRUT, sans préfixe « data:image… » : le pare-feu de l'hébergeur (koligo.trugroup.cm) répond 403 à toute
  // requête dont le corps contient « data:image ». Le serveur accepte les deux formes.
  return { uri: out.uri, base64: out.base64 };
}

async function toResult(result) {
  if (result.canceled) return { status: 'cancelled' };
  const asset = result.assets?.[0];
  if (!asset?.uri) return { status: 'error', message: "La photo n'a pas pu être lue. Réessayez." };
  try {
    return { status: 'ok', ...(await shrink(asset.uri)) };
  } catch (e) {
    return { status: 'error', message: `La photo n'a pas pu être préparée (${e?.message || 'erreur'}). Réessayez.` };
  }
}

export async function capturePhoto({ quality = 0.8 } = {}) {
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
    return await toResult(await ImagePicker.launchCameraAsync(OPTIONS(quality)));
  } catch (e) {
    return { status: 'error', message: `Impossible d'ouvrir la caméra (${e?.message || 'erreur inconnue'}).` };
  }
}

/** Solution de secours quand l'appli photo du téléphone ne rend pas de cliché : choisir une photo existante. */
export async function pickFromGallery({ quality = 0.8 } = {}) {
  try {
    return await toResult(await ImagePicker.launchImageLibraryAsync(OPTIONS(quality)));
  } catch (e) {
    return { status: 'error', message: `Impossible d'ouvrir la galerie (${e?.message || 'erreur inconnue'}).` };
  }
}

/** Photo prise juste avant qu'Android ne détruise l'activité de l'application (Android seulement). */
export async function recoverPendingPhoto() {
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    for (const r of Array.isArray(pending) ? pending : []) {
      const res = r && !r.code ? await toResult(r) : null;
      if (res?.status === 'ok') return res;
    }
  } catch { /* rien à récupérer */ }
  return null;
}
