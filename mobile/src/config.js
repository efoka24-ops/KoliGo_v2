import { Platform } from 'react-native';

// API URL can be overridden via EXPO_PUBLIC_API_BASE to avoid local port conflicts.
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE;

// Defaults:
// - Web: dedicated local backend on 3001 (3000 is often used by other apps)
// - Native devices: local LAN IP for backend on 3001
const DEFAULT_WEB_API_BASE = 'http://localhost:3001';
const DEFAULT_NATIVE_API_BASE = 'http://172.24.5.56:3001';
// Android emulator reaches the host machine via the 10.0.2.2 alias.
const DEFAULT_ANDROID_EMULATOR_API_BASE = 'http://10.0.2.2:3001';

export const API_BASE = ENV_API_BASE || (Platform.OS === 'web'
  ? DEFAULT_WEB_API_BASE
  : Platform.OS === 'android'
    ? DEFAULT_ANDROID_EMULATOR_API_BASE
    : DEFAULT_NATIVE_API_BASE);
