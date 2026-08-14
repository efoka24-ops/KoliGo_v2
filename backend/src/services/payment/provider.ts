// Contract every payment backend must satisfy. The rest of the app talks to
// this, never to a provider directly, so swapping providers is a config change.

export interface CashoutOptions {
  amount: number;
  phoneNumber: string;
  externalReference: string;
  notificationUrl?: string;
  description?: string;
  /** Donnees libres, restituees telles quelles dans le webhook. */
  metadata?: Record<string, unknown>;
}

export interface CashoutResult {
  /** Provider-side transaction id, stored as momoRef. */
  transactionId: string;
  amount: number;
  /** Raw provider status, normalised by isSettled/isFailed. */
  status: string;
  network?: string;
  /** Untouched provider payload, for logging and debugging. */
  raw: unknown;
}

export interface VerifyResult {
  transactionId: string;
  status: string;
  amount: number;
  completedAt: string | null;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  /** Collect money from the customer. */
  cashout(opts: CashoutOptions): Promise<CashoutResult>;
  /** Send money out to a deliverer. Not every provider supports it. */
  payout?(opts: CashoutOptions): Promise<CashoutResult>;
  verify(transactionId: string): Promise<VerifyResult>;
  getBalance(): Promise<{ balance: number; currency: string }>;
  /** Query params or body of the provider callback. */
  verifyWebhookSignature(params: Record<string, string>, rawBody?: string): boolean;
  /** Whether a status string means the money arrived. */
  isSettled(status: string): boolean;
  isFailed(status: string): boolean;
  /**
   * Status that is neither settled nor failed and must not be resolved
   * automatically — a human has to look at it.
   */
  needsAttention?(status: string): boolean;
}
