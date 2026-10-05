// Autorise le trafic HTTP en clair (usesCleartextTraffic) uniquement quand
// KOLIGO_ALLOW_CLEARTEXT=1, pour les builds de test contre un backend local
// (http://10.0.2.2:3001). Le build de production reste en HTTPS seul.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartext(config) {
  if (process.env.KOLIGO_ALLOW_CLEARTEXT !== '1') return config;
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
};
