import type { PaymentProvider } from './provider';
import { camooProvider } from './camoo.provider';

// PAYMENT_PROVIDER selects the backend at boot. Unknown values fall back to
// camoo rather than crashing, and say so, so a typo cannot take payments down.
const providers: Record<string, PaymentProvider> = {
  camoo: camooProvider,
};

const requested = (process.env.PAYMENT_PROVIDER ?? 'camoo').toLowerCase();
const selected = providers[requested];

if (!selected) {
  console.warn(`[payment] unknown PAYMENT_PROVIDER "${requested}" — falling back to camoo. Known: ${Object.keys(providers).join(', ')}`);
}

export const paymentProvider: PaymentProvider = selected ?? camooProvider;
export type { PaymentProvider, CashoutOptions, CashoutResult, VerifyResult } from './provider';
