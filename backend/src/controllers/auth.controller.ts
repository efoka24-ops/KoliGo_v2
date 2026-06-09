import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const sendOtp = wrap(async (req: Request) =>
  authService.sendOtp(req.body.phone)
);

export const verifyOtp = wrap(async (req: Request) =>
  authService.verifyOtp(req.body.phone, req.body.code)
);

export const signup = wrap(async (req: Request) =>
  authService.signup(req.body)
);

export const signin = wrap(async (req: Request) =>
  authService.signin(req.body.phone, req.body.pin)
);

export const refresh = wrap(async (req: Request) =>
  authService.refresh(req.body.token)
);

export const switchRole = wrap(async (req: AuthRequest) =>
  authService.switchRole(req.user!.userId, req.body.role)
);

export const getProfile = wrap(async (req: AuthRequest) =>
  prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: { id: true, name: true, phone: true, activeRole: true, kycStatus: true, language: true, theme: true },
  })
);

export const updateProfile = wrap(async (req: AuthRequest) =>
  prisma.user.update({ where: { id: req.user!.userId }, data: req.body })
);

export const updatePaymentAccount = wrap(async (req: AuthRequest) =>
  prisma.wallet.update({
    where: { userId: req.user!.userId },
    data: { paymentProvider: req.body.provider, paymentPhone: req.body.phone },
  })
);

export const submitKyc = wrap(async (req: AuthRequest) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const docs = [
    { type: 'ID_FRONT', file: files.idFront?.[0] },
    { type: 'ID_BACK', file: files.idBack?.[0] },
    { type: 'SELFIE', file: files.selfie?.[0] },
  ].filter((d) => d.file);

  await prisma.kycDocument.createMany({
    data: docs.map((d) => ({ userId: req.user!.userId, type: d.type, filePath: d.file!.path })),
  });
  await prisma.user.update({ where: { id: req.user!.userId }, data: { kycStatus: 'PENDING' } });
  return { status: 'PENDING' };
});
