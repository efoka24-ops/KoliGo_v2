import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const getBalance = wrap(async (req: AuthRequest) =>
  prisma.wallet.findUniqueOrThrow({
    where: { userId: req.user!.userId },
    select: { balanceXAF: true, paymentProvider: true, paymentPhone: true },
  })
);

export const getTransactions = wrap(async (req: AuthRequest) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.user!.userId } });
  return prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
});

export const withdraw = wrap(async (req: AuthRequest) => {
  const { amountXAF, provider, phoneNumber } = req.body;
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.user!.userId } });
  if (wallet.balanceXAF < amountXAF) throw new Error('Insufficient balance');

  // Deduct balance + create withdrawal record (CinetPay integration goes here)
  await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceXAF: { decrement: amountXAF } } }),
    prisma.withdrawal.create({ data: { walletId: wallet.id, amountXAF, provider, phone: phoneNumber } }),
  ]);
  return { ok: true };
});
