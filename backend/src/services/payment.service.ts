import axios from 'axios';
import crypto from 'crypto';

const BASE   = process.env.CAMOO_BASE_URL   ?? 'https://api.camoo.cm/v1/payment';
const KEY    = process.env.CAMOO_API_KEY    ?? '';
const SECRET = process.env.CAMOO_API_SECRET ?? '';

const headers = () => ({
  'X-Api-Key':    KEY,
  'X-Api-Secret': SECRET,
  'Content-Type': 'application/json',
});

export type MomoOperator = 'MTN_CM' | 'ORANGE_CM';

export interface CashoutOptions {
  amount: number;
  phoneNumber: string;
  externalReference: string;
  notificationUrl?: string;
  description?: string;
}

export const paymentService = {
  // POST /cashout — initiate a mobile money payment
  async cashout(opts: CashoutOptions) {
    const { data } = await axios.post(
      `${BASE}/cashout`,
      {
        amount:           opts.amount,
        phone_number:     opts.phoneNumber.startsWith('+') ? opts.phoneNumber : `+237${opts.phoneNumber.replace(/^237/, '')}`,
        currency:         'XAF',
        external_reference: opts.externalReference,
        notification_url: opts.notificationUrl,
        shopping_cart_details: {
          description: opts.description ?? 'KoliGo livraison',
          langKey: 'fr',
        },
      },
      { headers: headers(), timeout: 20_000 }
    );
    return data as { message: string; cashOut: { id: string; amount: number; status: string; network: string; code: number } };
  },

  // GET /verify?id={id} — poll transaction status
  async verify(transactionId: string) {
    const { data } = await axios.get(`${BASE}/verify`, {
      params: { id: transactionId },
      headers: headers(),
      timeout: 15_000,
    });
    return data as { code: number; message: string; verify: { id: string; status: string; amount: number; network: string; completed_at: string | null } };
  },

  // GET /account — check balance
  async getBalance() {
    const { data } = await axios.get(`${BASE}/account`, {
      headers: headers(),
      timeout: 10_000,
    });
    return data as { code: number; account: { balance: number; currency: string; date: string } };
  },

  // Verify Camoo webhook signature
  verifyWebhookSignature(queryParams: Record<string, string>): boolean {
    const { sig, ...rest } = queryParams;
    if (!sig) return false;
    const sorted = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&');
    const expected = crypto.createHmac('sha256', SECRET).update(sorted).digest('hex');
    return sig === expected;
  },
};
