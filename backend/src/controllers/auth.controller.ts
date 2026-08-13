import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../models/prisma';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const sendOtp = wrap(async (req: Request) =>
  authService.sendOtp(req.body.phone, req.body.email, req.body.name)
);

export const verifyOtp = wrap(async (req: Request) => {
  let phone = req.body.phone;
  if (!phone && req.body.email) {
    const user = await (await import('../models/prisma')).prisma.user.findFirst({ where: { email: req.body.email } });
    if (!user) throw new Error('Email introuvable');
    phone = user.phone;
  }
  return authService.verifyOtp(phone, req.body.code);
});

export const signup = wrap(async (req: Request) =>
  authService.signup(req.body)
);

export const signin = wrap(async (req: Request) =>
  authService.signin(req.body.email ?? req.body.phone, req.body.pin)
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
    select: { id: true, name: true, phone: true, activeRole: true, kycStatus: true, gender: true, shopName: true, language: true, theme: true },
  })
);

export const getUserStats = wrap(async (req: AuthRequest) => {
  const userId = req.user!.userId;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [wallet, todayEarnings, completedCourses, monthDeliveries, ratings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balanceXAF: true } }),
    prisma.transaction.aggregate({
      where: { wallet: { userId }, createdAt: { gte: today }, type: 'DELIVERY_EARNING' },
      _sum: { amountXAF: true },
    }),
    prisma.delivery.count({ where: { delivererId: userId, status: 'LIVRE' } }),
    prisma.delivery.count({
      where: { OR: [{ vendorId: userId }, { delivererId: userId }], createdAt: { gte: monthStart } },
    }),
    prisma.rating.aggregate({
      where: { toUserId: userId },
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  const avgScore = ratings._avg?.score ?? null;
  return {
    balance:      wallet?.balanceXAF ?? 0,
    gainsToday:   todayEarnings._sum.amountXAF ?? 0,
    courses:      completedCourses,
    totalMonth:   monthDeliveries,
    note:         avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
    ratingsCount: ratings._count?.score ?? 0,
  };
});

export const updateProfile = wrap(async (req: AuthRequest) =>
  prisma.user.update({ where: { id: req.user!.userId }, data: req.body })
);

export const updatePaymentAccount = wrap(async (req: AuthRequest) =>
  prisma.wallet.update({
    where: { userId: req.user!.userId },
    data: { paymentProvider: req.body.provider, paymentPhone: req.body.phone },
  })
);

export const forgotPin = wrap(async (req: Request) =>
  authService.forgotPin(req.body.email ?? req.body.phone)
);

export const resetPin = wrap(async (req: Request) =>
  authService.resetPin(req.body.email ?? req.body.phone, req.body.otp, req.body.newPin)
);

export const submitKyc = wrap(async (req: AuthRequest) => {
  const userId = req.user!.userId;

  // Accept both multipart (file upload) AND JSON base64 (mobile app sends base64)
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  if (files && Object.keys(files).length > 0) {
    // Multipart upload path
    const docs = [
      { type: 'ID_FRONT', file: files.idFront?.[0] },
      { type: 'ID_BACK',  file: files.idBack?.[0]  },
      { type: 'SELFIE',   file: files.selfie?.[0]  },
    ].filter((d) => d.file);
    await prisma.kycDocument.createMany({
      data: docs.map((d) => ({ userId, type: d.type, filePath: d.file!.path })),
    });
  } else {
    // JSON base64 path (mobile app)
    const { cniNumber, cniRecto, cniVerso, selfie } = req.body;
    const fs = await import('fs');
    const path = await import('path');
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const saveBase64 = (data: string, name: string): string => {
      const base64 = data.replace(/^data:image\/\w+;base64,/, '');
      const filePath = path.join(uploadDir, `${userId}_${name}_${Date.now()}.jpg`);
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      return filePath;
    };

    const docs: { type: string; filePath: string }[] = [];
    if (cniRecto) docs.push({ type: 'ID_FRONT', filePath: saveBase64(cniRecto, 'id_front') });
    if (cniVerso) docs.push({ type: 'ID_BACK',  filePath: saveBase64(cniVerso, 'id_back')  });
    if (selfie)   docs.push({ type: 'SELFIE',   filePath: saveBase64(selfie,   'selfie')   });

    if (docs.length > 0) {
      await prisma.kycDocument.createMany({ data: docs.map(d => ({ userId, ...d })) });
    }

    // Also store cniNumber on user profile
    if (cniNumber) {
      await prisma.user.update({ where: { id: userId }, data: { cniNumber: cniNumber.trim() } });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'PENDING' } });
  return { status: 'PENDING' };
});
