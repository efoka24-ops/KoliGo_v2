/**
 * Test de bout en bout des flux de paiement du portefeuille.
 *
 *   npx ts-node scripts/e2e-payments.ts
 *
 * Une passerelle factice remplace apisungku pour rester hors ligne et
 * deterministe, mais tout le code de KoliGo est reellement exerce : appels
 * HTTP du provider, routes Express, signature des webhooks, transactions en
 * base. Seule pawaPay est absente, et elle a ete validee separement par un
 * paiement MTN reel.
 */
import express from 'express';
import crypto from 'crypto';
import http from 'http';
import jwt from 'jsonwebtoken';

const PORT_PASSERELLE = 4999;
const PORT_APP = 4998;
const SECRET_WEBHOOK = 'secret-webhook-e2e';

process.env.DATABASE_URL = 'file:./e2e-payments.db';
process.env.JWT_ACCESS_SECRET = 'secret-acces-e2e';
process.env.JWT_REFRESH_SECRET = 'secret-refresh-e2e';
process.env.PAYMENT_PROVIDER = 'apisungku';
process.env.APISUNGKU_BASE_URL = `http://127.0.0.1:${PORT_PASSERELLE}/v1`;
process.env.APISUNGKU_API_KEY = 'sk_test_e2e';
process.env.APISUNGKU_WEBHOOK_SECRET = SECRET_WEBHOOK;

// Les imports doivent suivre la configuration : les modules lisent
// l'environnement a leur chargement.
/* eslint-disable @typescript-eslint/no-var-requires */
const { createApp } = require('../src/app');
const { prisma } = require('../src/models/prisma');

// ─── Passerelle factice ─────────────────────────────────────────────────────

interface OperationRecue {
  id: string;
  type: 'DEPOSIT' | 'PAYOUT';
  reference: string;
  amount: string;
  phoneNumber: string;
}

const recues: OperationRecue[] = [];

function demarrerPasserelle(): Promise<http.Server> {
  const gw = express();
  gw.use(express.json());

  const accepter = (type: 'DEPOSIT' | 'PAYOUT') => (req: any, res: any) => {
    if (req.header('X-Api-Key') !== 'sk_test_e2e') {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Cle invalide' } });
    }
    const op: OperationRecue = {
      id: crypto.randomUUID(),
      type,
      reference: req.body.reference,
      amount: req.body.amount,
      phoneNumber: req.body.phoneNumber,
    };
    recues.push(op);
    res.status(201).json({
      id: op.id,
      type,
      status: 'PROCESSING',
      amount: op.amount,
      currency: 'XAF',
      provider: 'MTN_MOMO_CMR',
      phoneNumber: op.phoneNumber,
      reference: op.reference,
    });
  };

  gw.post('/v1/deposits', accepter('DEPOSIT'));
  gw.post('/v1/payouts', accepter('PAYOUT'));
  gw.get('/v1/toolkit/balances', (_req, res) =>
    res.json({ balances: [{ country: 'CMR', currency: 'XAF', balance: '12500' }] })
  );

  return new Promise((resolve) => {
    const s = gw.listen(PORT_PASSERELLE, () => resolve(s));
  });
}

/** Envoie un webhook signe comme le fait la vraie passerelle. */
async function envoyerWebhook(op: OperationRecue, status: string, secret = SECRET_WEBHOOK) {
  const corps = JSON.stringify({
    event: `${op.type.toLowerCase()}.${status.toLowerCase()}`,
    sentAt: new Date().toISOString(),
    data: {
      id: op.id,
      type: op.type,
      status,
      amount: op.amount,
      currency: 'XAF',
      reference: op.reference,
    },
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${corps}`).digest('hex');

  const reponse = await fetch(`http://127.0.0.1:${PORT_APP}/payment/webhook/apisungku`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Apisungku-Signature': `sha256=${signature}`,
      'X-Apisungku-Timestamp': timestamp,
    },
    body: corps,
  });

  return reponse.status;
}

// ─── Utilitaires de test ────────────────────────────────────────────────────

let reussis = 0;
let echoues = 0;

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`  ${ok ? 'OK   ' : 'ECHEC'} ${intitule}${ok ? '' : ` — obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
  ok ? reussis++ : echoues++;
}

async function appelApp(chemin: string, methode: string, token: string, corps?: unknown) {
  const r = await fetch(`http://127.0.0.1:${PORT_APP}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  return { statut: r.status, corps: await r.json().catch(() => ({})) };
}

const solde = async (walletId: string) =>
  (await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } })).balanceXAF;

// ─── Scenarios ──────────────────────────────────────────────────────────────

async function main() {
  const passerelle = await demarrerPasserelle();
  const app = createApp();
  const serveur = await new Promise<http.Server>((r) => {
    const s = app.listen(PORT_APP, () => r(s));
  });

  // Jeu d'essai
  const user = await prisma.user.create({
    data: {
      email: `e2e-${Date.now()}@koligo.test`,
      name: 'Test E2E',
      phone: `2376${Date.now().toString().slice(-8)}`,
      pinHash: 'x',
      roles: '["DELIVERER"]',
      activeRole: 'DELIVERER',
    },
  });
  const wallet = await prisma.wallet.create({
    data: { userId: user.id, balanceXAF: 0, paymentProvider: 'MTN' },
  });
  const token = jwt.sign(
    { userId: user.id, phone: user.phone, activeRole: user.activeRole },
    process.env.JWT_ACCESS_SECRET!
  );

  console.log('\n=== 1. Rechargement abouti ===');
  {
    const r = await appelApp('/wallet/topup', 'POST', token, { amount: 5000, phone: '691227149' });
    verifier('la requete est acceptee', r.statut, 200);
    verifier('le solde reste a 0 avant autorisation', await solde(wallet.id), 0);

    const op = recues.at(-1)!;
    verifier('un depot est parti vers la passerelle', op.type, 'DEPOSIT');
    verifier('le montant est un entier en chaine', op.amount, '5000');
    verifier('le numero est au format MSISDN', op.phoneNumber, '237691227149');

    verifier('le webhook est accepte', await envoyerWebhook(op, 'COMPLETED'), 200);
    verifier('le solde est credite', await solde(wallet.id), 5000);
  }

  console.log('\n=== 2. Rejeu du meme webhook ===');
  {
    const op = recues.at(-1)!;
    verifier('le rejeu est accepte', await envoyerWebhook(op, 'COMPLETED'), 200);
    verifier('le solde n\'est PAS credite deux fois', await solde(wallet.id), 5000);
  }

  console.log('\n=== 3. Rechargement echoue ===');
  {
    await appelApp('/wallet/topup', 'POST', token, { amount: 2000, phone: '691227149' });
    const op = recues.at(-1)!;
    await envoyerWebhook(op, 'FAILED');
    verifier('le solde est inchange', await solde(wallet.id), 5000);
    const t = await prisma.topUp.findUnique({ where: { externalRef: op.reference } });
    verifier('le rechargement est marque FAILED', t.status, 'FAILED');
  }

  console.log('\n=== 4. Webhook falsifie ===');
  {
    await appelApp('/wallet/topup', 'POST', token, { amount: 9000, phone: '691227149' });
    const op = recues.at(-1)!;
    verifier('la signature invalide est rejetee', await envoyerWebhook(op, 'COMPLETED', 'mauvais-secret'), 401);
    verifier('le solde est intact', await solde(wallet.id), 5000);
  }

  console.log('\n=== 5. Retrait abouti ===');
  {
    const r = await appelApp('/wallet/withdraw', 'POST', token, {
      amount: 2000, provider: 'MTN', phone: '691227149',
    });
    verifier('la requete est acceptee', r.statut, 200);
    verifier('le solde est debite immediatement', await solde(wallet.id), 3000);

    const op = recues.at(-1)!;
    verifier('un reversement est parti', op.type, 'PAYOUT');

    await envoyerWebhook(op, 'COMPLETED');
    const w = await prisma.withdrawal.findUnique({ where: { externalRef: op.reference } });
    verifier('le retrait est marque SUCCESS', w.status, 'SUCCESS');
    verifier('le solde reste debite', await solde(wallet.id), 3000);
  }

  console.log('\n=== 6. Retrait echoue : le solde doit revenir ===');
  {
    await appelApp('/wallet/withdraw', 'POST', token, {
      amount: 1000, provider: 'MTN', phone: '691227149',
    });
    verifier('le solde est debite', await solde(wallet.id), 2000);

    const op = recues.at(-1)!;
    await envoyerWebhook(op, 'FAILED');
    verifier('le solde est restitue', await solde(wallet.id), 3000);
    const w = await prisma.withdrawal.findUnique({ where: { externalRef: op.reference } });
    verifier('le retrait est marque FAILED', w.status, 'FAILED');
  }

  console.log('\n=== 7. Garde-fous ===');
  {
    const trop = await appelApp('/wallet/withdraw', 'POST', token, {
      amount: 999999, provider: 'MTN', phone: '691227149',
    });
    verifier('un solde insuffisant est refuse', trop.statut, 400);
    verifier('le solde est intact', await solde(wallet.id), 3000);

    const petit = await appelApp('/wallet/topup', 'POST', token, { amount: 50, phone: '691227149' });
    verifier('un montant sous le minimum est refuse', petit.statut, 400);

    const sansAuth = await fetch(`http://127.0.0.1:${PORT_APP}/wallet/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, phone: '691227149' }),
    });
    verifier('un appel sans jeton est refuse', sansAuth.status === 200, false);
  }

  console.log('\n=== 8. NEEDS_ATTENTION ne conclut rien ===');
  {
    await appelApp('/wallet/topup', 'POST', token, { amount: 4000, phone: '691227149' });
    const op = recues.at(-1)!;
    await envoyerWebhook(op, 'NEEDS_ATTENTION');
    verifier('le solde n\'est pas credite', await solde(wallet.id), 3000);
    const t = await prisma.topUp.findUnique({ where: { externalRef: op.reference } });
    verifier('le rechargement reste PENDING', t.status, 'PENDING');
  }

  console.log(`\n──────────────────────────────\n${reussis} verifications reussies, ${echoues} en echec\n`);

  await prisma.$disconnect();
  serveur.close();
  passerelle.close();
  process.exit(echoues === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
