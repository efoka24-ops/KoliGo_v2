import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';

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

export const withdraw = wrap(async (req: AuthRequest) => {
  // Accept both shapes from mobile: { amount, provider, phone } or { amountXAF, provider, phoneNumber }
  const amountXAF = req.body.amount ?? req.body.amountXAF;
  const provider = req.body.provider;
  const phoneNumber = req.body.phone ?? req.body.phoneNumber;

  if (!amountXAF || amountXAF < 500) throw new Error('Montant minimum 500 XAF');

  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.user!.userId } });
  if (wallet.balanceXAF < amountXAF) throw new Error('Solde insuffisant');

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceXAF: { decrement: amountXAF } } }),
    prisma.withdrawal.create({ data: { walletId: wallet.id, amountXAF, provider, phone: phoneNumber } }),
    prisma.transaction.create({ data: { walletId: wallet.id, type: 'WITHDRAWAL', amountXAF, description: `Retrait ${provider}` } }),
  ]);
  return { ok: true };
});
