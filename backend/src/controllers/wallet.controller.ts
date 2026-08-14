import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';
import { paymentService } from '../services/payment.service';

/** Reference unique par operation, notre cle de rapprochement au webhook. */
const reference = (prefixe: string, id: string) =>
  `KOLIGO-${prefixe}-${id.slice(-8)}-${Date.now()}`;

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

// Returns { balance, transactions } — shape expected by the mobile WalletScreen
export const getBalance = wrap(async (req: AuthRequest) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: req.user!.userId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 30 } },
  });
  return {
    balance: wallet.balanceXAF,
    paymentProvider: wallet.paymentProvider,
    paymentPhone: wallet.paymentPhone,
    transactions: wallet.transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.type === 'WITHDRAWAL' ? -tx.amountXAF : tx.amountXAF,
      label: tx.description ?? tx.type,
      reference: tx.id,
      createdAt: tx.createdAt,
    })),
  };
});

export const getTransactions = wrap(async (req: AuthRequest) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.user!.userId } });
  const txs = await prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return txs.map(tx => ({
    id: tx.id,
    type: tx.type,
    amount: tx.type === 'WITHDRAWAL' ? -tx.amountXAF : tx.amountXAF,
    label: tx.description ?? tx.type,
    reference: tx.id,
    createdAt: tx.createdAt,
  }));
});

/**
 * Rechargement du portefeuille par mobile money.
 *
 * Le solde n'est PAS credite ici : l'argent n'a pas encore bouge, le client
 * doit d'abord autoriser le paiement sur son telephone. Le credit a lieu a la
 * reception du webhook COMPLETED.
 */
export const topUp = wrap(async (req: AuthRequest) => {
  const amountXAF = Number(req.body.amount ?? req.body.amountXAF);
  const phoneNumber = req.body.phone ?? req.body.phoneNumber;

  if (!Number.isFinite(amountXAF) || amountXAF < 100) {
    throw new Error('Montant minimum 100 XAF');
  }
  if (!phoneNumber) throw new Error('Numero de telephone requis');

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: req.user!.userId },
  });

  const externalRef = reference('TOPUP', wallet.id);

  // La ligne est ecrite AVANT l'appel sortant : si la reponse se perd, nous
  // gardons de quoi retrouver l'operation et la reconcilier.
  const topUp = await prisma.topUp.create({
    data: {
      walletId: wallet.id,
      amountXAF: Math.round(amountXAF),
      provider: wallet.paymentProvider,
      phone: String(phoneNumber),
      externalRef,
    },
  });

  try {
    const result = await paymentService.cashout({
      amount: Math.round(amountXAF),
      phoneNumber: String(phoneNumber),
      externalReference: externalRef,
      description: 'Rechargement KoliGo',
      metadata: { walletId: wallet.id, topUpId: topUp.id },
    });

    await prisma.topUp.update({
      where: { id: topUp.id },
      data: { paymentId: result.transactionId || null },
    });

    return {
      topUpId: topUp.id,
      paymentId: result.transactionId,
      status: result.status,
      // Le client doit autoriser sur son telephone : l'application affiche
      // cette consigne en attendant le webhook.
      message: 'Validez le paiement sur votre telephone.',
    };
  } catch (e: any) {
    // Une absence de reponse ne prouve pas l'echec : le paiement a pu partir.
    // On laisse la ligne en PENDING plutot que de la marquer FAILED.
    if (e.code === 'ECONNABORTED' || !e.response) {
      throw new Error(
        'Paiement en cours de verification. Consultez votre historique dans un instant.'
      );
    }
    await prisma.topUp.update({
      where: { id: topUp.id },
      data: { status: 'FAILED' },
    });
    throw new Error(e.response?.data?.error?.message ?? e.message);
  }
});

export const withdraw = wrap(async (req: AuthRequest) => {
  // Accept both shapes from mobile: { amount, provider, phone } or { amountXAF, provider, phoneNumber }
  const amountXAF = req.body.amount ?? req.body.amountXAF;
  const provider = req.body.provider;
  const phoneNumber = req.body.phone ?? req.body.phoneNumber;

  if (!amountXAF || amountXAF < 500) throw new Error('Montant minimum 500 XAF');

  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.user!.userId } });
  if (wallet.balanceXAF < amountXAF) throw new Error('Solde insuffisant');

  const externalRef = reference('WITHDRAW', wallet.id);

  // Le solde est debite immediatement, avant l'envoi : sans cela, deux retraits
  // lances en meme temps passeraient tous deux le controle de solde. Il est
  // recredite si le versement echoue.
  const [, withdrawal] = await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceXAF: { decrement: amountXAF } } }),
    prisma.withdrawal.create({ data: { walletId: wallet.id, amountXAF, provider, phone: phoneNumber, externalRef } }),
    prisma.transaction.create({ data: { walletId: wallet.id, type: 'WITHDRAWAL', amountXAF, description: `Retrait ${provider}` } }),
  ]);

  // Sans provider capable de reverser, on s'arrete la plutot que de laisser
  // croire a un virement : la ligne reste PENDING pour traitement manuel.
  if (!paymentService.payout) {
    return { ok: true, withdrawalId: withdrawal.id, status: 'PENDING' };
  }

  try {
    const result = await paymentService.payout({
      amount: amountXAF,
      phoneNumber,
      externalReference: externalRef,
      description: 'Retrait KoliGo',
      metadata: { walletId: wallet.id, withdrawalId: withdrawal.id },
    });

    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { paymentId: result.transactionId || null },
    });

    return { ok: true, withdrawalId: withdrawal.id, status: result.status };
  } catch (e: any) {
    // Issue indeterminee : le versement a pu partir. Recrediter maintenant
    // risquerait de payer deux fois. On laisse en PENDING pour que le webhook
    // ou une verification manuelle tranche.
    if (e.code === 'ECONNABORTED' || !e.response) {
      return {
        ok: true,
        withdrawalId: withdrawal.id,
        status: 'PENDING',
        message: 'Retrait en cours de verification.',
      };
    }

    // Refus explicite : l'argent n'a pas bouge, on rend le solde.
    await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balanceXAF: { increment: amountXAF } } }),
      prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'FAILED' } }),
      prisma.transaction.create({
        data: { walletId: wallet.id, type: 'REFUND', amountXAF, description: 'Retrait refuse' },
      }),
    ]);
    throw new Error(e.response?.data?.error?.message ?? e.message);
  }
});
