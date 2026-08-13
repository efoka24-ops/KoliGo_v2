import { Platform } from 'react-native';

// API URL can be overridden via EXPO_PUBLIC_API_BASE (e.g. to point a dev build
// at production, or a device at a LAN address).
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE;

// Hosted backend — used by every release build.
const PRODUCTION_API_BASE = 'https://koligoapi.trugroup.cm';

// Dev defaults, per platform:
// - Web: local backend on 3001 (3000 is often taken by another app)
// - Android emulator: the host machine is reachable via the 10.0.2.2 alias
// - iOS simulator / physical devices: localhost, or set EXPO_PUBLIC_API_BASE
const DEV_WEB_API_BASE = 'http://localhost:3001';
const DEV_ANDROID_EMULATOR_API_BASE = 'http://10.0.2.2:3001';
const DEV_NATIVE_API_BASE = 'http://localhost:3001';

function devBase() {
  if (Platform.OS === 'web') return DEV_WEB_API_BASE;
  if (Platform.OS === 'android') return DEV_ANDROID_EMULATOR_API_BASE;
  return DEV_NATIVE_API_BASE;
}

export const API_BASE = ENV_API_BASE || (__DEV__ ? devBase() : PRODUCTION_API_BASE);
