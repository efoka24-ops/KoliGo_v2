// API URL can be overridden via EXPO_PUBLIC_API_BASE at build time.
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const DEFAULT_DEV_API_BASE = 'http://10.0.2.2:3000';
const DEFAULT_PROD_API_BASE = 'https://koligoapi.trugroup.cm';

export const API_BASE = ENV_API_BASE || (__DEV__
  ? DEFAULT_DEV_API_BASE
  : DEFAULT_PROD_API_BASE);
