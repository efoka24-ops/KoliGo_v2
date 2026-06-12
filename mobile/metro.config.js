const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field so axios 1.x resolves correctly
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
