import { Request, Response } from 'express';
import { prisma } from '../models/prisma';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const getStats = wrap(async () => ({
  users: await prisma.user.count(),
  deliveries: await prisma.delivery.count(),
  pendingKyc: await prisma.user.count({ where: { kycStatus: 'PENDING' } }),
  activeDeliveries: await prisma.delivery.count({ where: { status: { in: ['EN_ATTENTE', 'ACCEPTE', 'EN_ROUTE'] } } }),
}));

export const listUsers = wrap(async (req: Request) => {
  const { q, page = 1 } = req.query as any;
  return prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 25,
    skip: (page - 1) * 25,
    select: { id: true, name: true, phone: true, activeRole: true, kycStatus: true, isBlocked: true, createdAt: true },
  });
});

export const getUser = wrap(async (req: Request) =>
  prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { kycDocuments: true, wallet: true },
  })
);

export const blockUser = wrap(async (req: Request) =>
  prisma.user.update({ where: { id: req.params.id }, data: { isBlocked: req.body.blocked } })
);

export const reviewKyc = wrap(async (req: Request) =>
  prisma.user.update({ where: { id: req.params.id }, data: { kycStatus: req.body.status } })
);

export const listDeliveries = wrap(async (req: Request) => {
  const { status, page = 1 } = req.query as any;
  return prisma.delivery.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 25,
    skip: (page - 1) * 25,
  });
});

export const cancelDelivery = wrap(async (req: Request) =>
  prisma.delivery.update({ where: { id: req.params.id }, data: { status: 'ANNULE' } })
);

export const getSettings = wrap(async () =>
  prisma.platformSetting.findMany()
);

export const updateSetting = wrap(async (req: Request) =>
  prisma.platformSetting.upsert({
    where: { key: req.body.key },
    update: { value: req.body.value },
    create: { key: req.body.key, value: req.body.value },
  })
);
