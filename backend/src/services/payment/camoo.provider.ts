import axios from 'axios';
import crypto from 'crypto';
import type { PaymentProvider, CashoutOptions, CashoutResult, VerifyResult } from './provider';

const BASE   = process.env.CAMOO_BASE_URL   ?? 'https://api.camoo.cm/v1/payment';
const KEY    = process.env.CAMOO_API_KEY    ?? '';
const SECRET = process.env.CAMOO_API_SECRET ?? '';

const headers = () => ({
  'X-Api-Key': KEY,
  'X-Api-Secret': SECRET,
  'Content-Type': 'application/json',
});

const SETTLED = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'CONFIRMED'];
const FAILED  = ['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'];

export const camooProvider: PaymentProvider = {
  name: 'camoo',

  async cashout(opts: CashoutOptions): Promise<CashoutResult> {
    const { data } = await axios.post(
      `${BASE}/cashout`,
      {
        amount: opts.amount,
        phone_number: opts.phoneNumber.startsWith('+')
          ? opts.phoneNumber
          : `+237${opts.phoneNumber.replace(/^237/, '')}`,
        currency: 'XAF',
        external_reference: opts.externalReference,
        notification_url: opts.notificationUrl,
        shopping_cart_details: {
          description: opts.description ?? 'KoliGo livraison',
          langKey: 'fr',
        },
      },
      { headers: headers(), timeout: 20_000 }
    );
    const c = data?.cashOut ?? {};
    return { transactionId: String(c.id ?? ''), amount: Number(c.amount ?? opts.amount), status: String(c.status ?? ''), network: c.network, raw: data };
  },

  async verify(transactionId: string): Promise<VerifyResult> {
    const { data } = await axios.get(`${BASE}/verify`, {
      params: { id: transactionId },
      headers: headers(),
      timeout: 15_000,
    });
    const v = data?.verify ?? {};
    return { transactionId: String(v.id ?? transactionId), status: String(v.status ?? ''), amount: Number(v.amount ?? 0), completedAt: v.completed_at ?? null, raw: data };
  },

  async getBalance() {
    const { data } = await axios.get(`${BASE}/account`, { headers: headers(), timeout: 10_000 });
    return { balance: Number(data?.account?.balance ?? 0), currency: String(data?.account?.currency ?? 'XAF') };
  },

  verifyWebhookSignature(params: Record<string, string>): boolean {
    const { sig, ...rest } = params;
    if (!sig) return false;
    const sorted = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&');
    const expected = crypto.createHmac('sha256', SECRET).update(sorted).digest('hex');
    return sig === expected;
  },

  isSettled: (s) => SETTLED.includes(String(s).toUpperCase()),
  isFailed:  (s) => FAILED.includes(String(s).toUpperCase()),
};
