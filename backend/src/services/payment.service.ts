// Kept as the historical import path. The implementation now lives behind
// PaymentProvider (src/services/payment/), selected by PAYMENT_PROVIDER, so
// callers no longer see any provider-specific response shape.
export { paymentProvider as paymentService } from './payment';
export type { CashoutOptions, CashoutResult, VerifyResult } from './payment';
