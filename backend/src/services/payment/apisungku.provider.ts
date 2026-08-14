import axios from 'axios';
import crypto from 'crypto';
import type { PaymentProvider, CashoutOptions, CashoutResult, VerifyResult } from './provider';

// Passerelle apisungku : un seul service parle aux operateurs mobile money,
// KoliGo n'y voit qu'une API HTTP et ne detient aucun secret d'operateur.
const BASE    = process.env.APISUNGKU_BASE_URL ?? 'https://apisungku.trugroup.cm/v1';
const API_KEY = process.env.APISUNGKU_API_KEY ?? '';
const WEBHOOK_SECRET = process.env.APISUNGKU_WEBHOOK_SECRET ?? '';

const headers = () => ({
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json',
});

// Statuts normalises par la passerelle. NEEDS_ATTENTION est volontairement
// absent des deux listes : il signifie « issue indeterminee », donc ni reussi
// ni echoue. Le traiter comme un echec ferait annuler des livraisons payees.
const SETTLED = ['COMPLETED'];
const FAILED  = ['FAILED'];

/** Met le numero au format MSISDN attendu : 237XXXXXXXXX, sans + ni espaces. */
function toMsisdn(phone: string): string {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  return `237${digits.replace(/^0+/, '')}`;
}

/** Le libelle affiche au payeur sur l'invite PIN : 4 a 22 caracteres. */
function customerMessage(description?: string): string {
  const base = (description ?? 'Livraison KoliGo').replace(/\s+/g, ' ').trim();
  return base.length > 22 ? base.slice(0, 22) : base.padEnd(4, ' ').trimEnd();
}

export const apisungkuProvider: PaymentProvider & {
  payout(opts: CashoutOptions): Promise<CashoutResult>;
  verifyWebhookRaw(rawBody: string, hdrs: Record<string, string | undefined>): boolean;
} = {
  name: 'apisungku',

  async cashout(opts: CashoutOptions): Promise<CashoutResult> {
    const { data } = await axios.post(
      `${BASE}/deposits`,
      {
        // Le XAF n'accepte pas de decimales : on arrondit avant d'envoyer
        // plutot que de se faire rejeter par l'operateur.
        amount: String(Math.round(opts.amount)),
        currency: 'XAF',
        phoneNumber: toMsisdn(opts.phoneNumber),
        // externalReference est unique par livraison : la passerelle s'en sert
        // comme cle d'idempotence, ce qui neutralise un double clic.
        reference: opts.externalReference,
        description: opts.description,
        ...(opts.metadata ? { metadata: opts.metadata } : {}),
        customerMessage: customerMessage(opts.description),
      },
      { headers: headers(), timeout: 25_000 }
    );

    return {
      transactionId: String(data.id ?? ''),
      amount: Number(data.amount ?? opts.amount),
      status: String(data.status ?? ''),
      network: data.provider ?? undefined,
      raw: data,
    };
  },

  /**
   * Reversement vers le portefeuille d'un transporteur. Absent de l'interface
   * commune, Camoo ne l'exposant pas : appeler via `paymentProvider.payout?.()`.
   */
  async payout(opts: CashoutOptions): Promise<CashoutResult> {
    const { data } = await axios.post(
      `${BASE}/payouts`,
      {
        amount: String(Math.round(opts.amount)),
        currency: 'XAF',
        phoneNumber: toMsisdn(opts.phoneNumber),
        reference: opts.externalReference,
        description: opts.description,
        ...(opts.metadata ? { metadata: opts.metadata } : {}),
        customerMessage: customerMessage(opts.description ?? 'Paiement KoliGo'),
      },
      { headers: headers(), timeout: 25_000 }
    );

    return {
      transactionId: String(data.id ?? ''),
      amount: Number(data.amount ?? opts.amount),
      status: String(data.status ?? ''),
      network: data.provider ?? undefined,
      raw: data,
    };
  },

  async verify(transactionId: string): Promise<VerifyResult> {
    const { data } = await axios.get(
      `${BASE}/transactions/${encodeURIComponent(transactionId)}`,
      { headers: headers(), timeout: 15_000 }
    );

    return {
      transactionId: String(data.id ?? transactionId),
      status: String(data.status ?? ''),
      amount: Number(data.amount ?? 0),
      completedAt: data.completedAt ?? null,
      raw: data,
    };
  },

  async getBalance() {
    const { data } = await axios.get(`${BASE}/toolkit/balances`, {
      headers: headers(),
      timeout: 15_000,
    });

    const cmr = (data?.balances ?? []).find(
      (b: any) => b.country === 'CMR' && b.currency === 'XAF'
    );

    return { balance: Number(cmr?.balance ?? 0), currency: 'XAF' };
  },

  /**
   * apisungku signe le corps brut d'un POST, la ou Camoo signe la query
   * string. `params` recoit donc les en-tetes de la requete, et rawBody le
   * corps non parse : re-serialiser le JSON invaliderait la signature.
   */
  verifyWebhookSignature(params: Record<string, string>, rawBody?: string): boolean {
    if (rawBody === undefined) return false;
    return apisungkuProvider.verifyWebhookRaw(rawBody, params);
  },

  /**
   * Verifie l'authenticite d'un webhook apisungku.
   *
   * Sans cette verification, quiconque connait l'URL peut annoncer un paiement
   * reussi et declencher une livraison jamais payee.
   */
  verifyWebhookRaw(rawBody: string, hdrs: Record<string, string | undefined>): boolean {
    if (!WEBHOOK_SECRET) return false;

    const signature = hdrs['x-apisungku-signature'];
    const timestamp = hdrs['x-apisungku-timestamp'];
    if (!signature || !timestamp) return false;

    // Fenetre de 5 minutes : sans elle, une signature valide capturee reste
    // rejouable indefiniment.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) return false;

    const expected =
      'sha256=' +
      crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  isSettled: (s) => SETTLED.includes(String(s).toUpperCase()),
  isFailed:  (s) => FAILED.includes(String(s).toUpperCase()),

  // Ni reussi ni echoue : l'argent a peut-etre bouge. Escalade humaine, jamais
  // d'annulation automatique de la livraison.
  needsAttention: (s) => String(s).toUpperCase() === 'NEEDS_ATTENTION',
};
