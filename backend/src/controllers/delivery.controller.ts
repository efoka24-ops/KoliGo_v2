import { Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
import { geoService } from '../services/geo.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { verifyAccess } from '../utils/jwt';
import { prisma } from '../models/prisma';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const create = wrap(async (req: AuthRequest) =>
  deliveryService.create(req.user!.userId, req.body)
);

export const list = wrap(async (req: AuthRequest) => {
  const { status, page = 1 } = req.query as any;
  return prisma.delivery.findMany({
    where: { OR: [{ vendorId: req.user!.userId }, { delivererId: req.user!.userId }], ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    skip: (page - 1) * 20,
  });
});

export const getById = wrap(async (req: AuthRequest) =>
  prisma.delivery.findUniqueOrThrow({ where: { id: req.params.id } })
);

export const accept = wrap(async (req: AuthRequest) =>
  deliveryService.accept(req.params.id, req.user!.userId)
);

export const cancel = wrap(async (req: AuthRequest) =>
  deliveryService.cancel(req.params.id, req.user!.userId)
);

export const confirmCollect = wrap(async (req: AuthRequest) =>
  deliveryService.confirmCollect(req.params.id, req.user!.userId, req.body.collectCode)
);

export const confirmDeliver = wrap(async (req: AuthRequest) =>
  deliveryService.confirmDeliver(req.params.id, req.user!.userId, req.body.deliverCode, req.body.momoRef)
);

export const postLocation = wrap(async (req: AuthRequest) => {
  await geoService.write(req.params.id, req.body.latitude, req.body.longitude);
  return { ok: true };
});

export const getLocation = wrap(async (req: Request) =>
  geoService.read(req.params.id)
);

export const trackByClientToken = wrap(async (req: Request) => {
  const payload = verifyAccess(req.params.clientToken) as any;
  return prisma.delivery.findUniqueOrThrow({
    where: { id: payload.deliveryId },
    select: { id: true, status: true, pickupAddress: true, dropoffAddress: true, deliverCode: true, priceXAF: true },
  });
});
