import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';

export async function postRating(req: AuthRequest, res: Response) {
  try {
    const { deliveryId, score, tags = [], comment } = req.body;
    const delivery = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    const toUserId = delivery.vendorId === req.user!.userId ? delivery.delivererId! : delivery.vendorId;

    const rating = await prisma.rating.create({
      data: {
        deliveryId,
        fromUserId: req.user!.userId,
        toUserId,
        score,
        tags: JSON.stringify(tags),
        comment,
      },
    });
    res.status(201).json(rating);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
