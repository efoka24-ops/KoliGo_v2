import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

/**
 * Capture une vue (le reçu) et l'enregistre comme image dans la galerie du téléphone.
 * Sur le web, le fichier est téléchargé. Retourne 'gallery' ou 'download'.
 * Lève une erreur de code 'PERMISSION_DENIED' si l'accès à la galerie est refusé.
 */
export async function saveReceiptImage(viewRef, { format = 'png', name = 'recu-koligo' } = {}) {
  const fmt = format === 'jpg' ? 'jpg' : 'png';
  const uri = await captureRef(viewRef, {
    format: fmt,
    quality: 0.95,
    result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
  });

  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `${name}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return 'download';
  }

  // writeOnly : on demande seulement le droit d'écrire, pas de lire les photos de l'utilisateur.
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    const err = new Error('Autorisez l\'accès à la galerie pour enregistrer le reçu.');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }
  await MediaLibrary.saveToLibraryAsync(uri);
  return 'gallery';
}
