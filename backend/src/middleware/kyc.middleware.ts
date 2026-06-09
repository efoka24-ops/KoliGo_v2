import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../models/prisma';

export async function requireKyc(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { kycStatus: true, isBlocked: true },
  });
  if (!user || user.kycStatus !== 'VERIFIED') {
    res.status(403).json({ error: 'KYC verification required' });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: 'Account blocked' });
    return;
  }
  next();
}
