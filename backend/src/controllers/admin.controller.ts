import { Request, Response } from 'express';
import { prisma } from '../models/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const getStats = wrap(async () => {
  const now = Date.now();
  const ago30 = new Date(now - 30 * 86_400_000);
  const ago7  = new Date(now - 7  * 86_400_000);

  const [
    users, deliveries, pendingKyc,
    recentDeliveries, statusGroups, activeDeliverers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.delivery.count(),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.delivery.findMany({
      where: { createdAt: { gte: ago30 } },
      select: { priceXAF: true, commissionXAF: true, createdAt: true, status: true },
    }),
    prisma.delivery.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { isOnline: true, roles: { contains: 'DELIVERER' } } }),
  ]);

  const livrées = recentDeliveries.filter(d => d.status === 'LIVRE');
  const gmv30d        = livrées.reduce((s, d) => s + d.priceXAF, 0);
  const commission30d = livrées.reduce((s, d) => s + d.commissionXAF, 0);

  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const trend = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(ago7.getTime() + i * 86_400_000);
    const end   = new Date(start.getTime() + 86_400_000);
    const bucket = recentDeliveries.filter(d => {
      const t = new Date(d.createdAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    return {
      day: days[start.getDay()],
      gmv: bucket.filter(d => d.status === 'LIVRE').reduce((s, d) => s + d.priceXAF, 0),
      count: bucket.length,
    };
  });

  const statusBreakdown: Record<string, number> = {};
  statusGroups.forEach(g => { statusBreakdown[g.status] = g._count._all; });

  return {
    users,
    deliveries,
    deliveries30d: recentDeliveries.length,
    pendingKyc,
    activeDeliveries: statusBreakdown['EN_ATTENTE'] ?? 0,
    activeDeliverers,
    gmv30d,
    commission30d,
    trend,
    statusBreakdown,
  };
});

export const listUsers = wrap(async (req: Request) => {
  const { q, role, page = 1 } = req.query as any;
  const where: any = {};
  if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q } }];
  if (role) where.roles = { contains: role };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25, skip: (Number(page) - 1) * 25,
      select: {
        id: true, name: true, phone: true, email: true,
        activeRole: true, roles: true, kycStatus: true,
        isBlocked: true, isOnline: true, createdAt: true,
        _count: { select: { vendorDeliveries: true, delivererDeliveries: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
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

export const reviewKyc = wrap(async (req: Request) => {
  const { status, reason } = req.body;
  return prisma.user.update({
    where: { id: req.params.id },
    data: {
      kycStatus: status,
      kycRejectionReason: status === 'REJECTED' ? (reason ?? null) : null,
    },
  });
});

export const serveKycDoc = async (req: any, res: any) => {
  try {
    const doc = await prisma.kycDocument.findUniqueOrThrow({ where: { id: req.params.docId } });
    const fs   = await import('fs');
    const path = await import('path');
    if (!fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const ext  = path.extname(doc.filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(doc.filePath).pipe(res);
  } catch (e: any) {
    res.status(404).json({ error: 'Document not found' });
  }
};

export const listDeliveries = wrap(async (req: Request) => {
  const { status, page = 1 } = req.query as any;
  const where: any = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25, skip: (Number(page) - 1) * 25,
      include: {
        vendor:    { select: { name: true, phone: true } },
        deliverer: { select: { name: true, phone: true } },
      },
    }),
    prisma.delivery.count({ where }),
  ]);
  return { items, total };
});

export const cancelDelivery = wrap(async (req: Request) =>
  prisma.delivery.update({ where: { id: req.params.id }, data: { status: 'ANNULE' } })
);

export const getFinance = wrap(async () => {
  const [commAgg, walletAgg, transactions, pendingWithdrawals] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'COMMISSION' }, _sum: { amountXAF: true } }),
    prisma.wallet.aggregate({ _sum: { balanceXAF: true } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { wallet: { select: { user: { select: { name: true, phone: true } } } } },
    }),
    prisma.withdrawal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { wallet: { select: { user: { select: { name: true, phone: true } } } } },
    }),
  ]);
  return {
    platformBalance: commAgg._sum.amountXAF ?? 0,
    totalWallets:    walletAgg._sum.balanceXAF ?? 0,
    pendingCount:    pendingWithdrawals.length,
    pendingAmount:   pendingWithdrawals.reduce((s, w) => s + w.amountXAF, 0),
    transactions,
    pendingWithdrawals,
  };
});

export const payWithdrawal = wrap(async (req: Request) =>
  prisma.withdrawal.update({ where: { id: req.params.id }, data: { status: 'SUCCESS' } })
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

// ─── Cities & Neighborhoods ───────────────────────────────────────────────────

export const listCities = wrap(async (req: Request) => {
  const withCount = req.query.withCount === 'true';
  return prisma.city.findMany({
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
    include: withCount ? { _count: { select: { neighborhoods: true } } } : undefined,
  });
});

export const createCity = wrap(async (req: Request) => {
  const { name, region } = req.body;
  if (!name || !region) throw new Error('name et region requis');
  return prisma.city.create({ data: { name, region } });
});

export const updateCity = wrap(async (req: Request) => {
  const { name, region, isActive } = req.body;
  return prisma.city.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(region && { region }), ...(isActive !== undefined && { isActive }) },
  });
});

export const deleteCity = wrap(async (req: Request) => {
  await prisma.neighborhood.deleteMany({ where: { cityId: req.params.id } });
  return prisma.city.delete({ where: { id: req.params.id } });
});

export const listNeighborhoods = wrap(async (req: Request) =>
  prisma.neighborhood.findMany({
    where: { cityId: req.params.cityId },
    orderBy: { name: 'asc' },
  })
);

export const createNeighborhood = wrap(async (req: Request) => {
  const { name, latitude, longitude } = req.body;
  if (!name) throw new Error('name requis');
  return prisma.neighborhood.create({
    data: { name, cityId: req.params.cityId, latitude, longitude },
  });
});

export const updateNeighborhood = wrap(async (req: Request) => {
  const { name, latitude, longitude, isActive } = req.body;
  return prisma.neighborhood.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(isActive !== undefined && { isActive }),
    },
  });
});

export const deleteNeighborhood = wrap(async (req: Request) =>
  prisma.neighborhood.delete({ where: { id: req.params.id } })
);

// ─── Issues / Support ─────────────────────────────────────────────────────────

export const listIssues = wrap(async (req: Request) => {
  const { status, page = 1 } = req.query as any;
  const where: any = status && status !== 'all' ? { status: status.toUpperCase() } : {};
  const [items, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 30, skip: (Number(page) - 1) * 30,
      include: {
        user:     { select: { name: true, phone: true } },
        delivery: { select: { pickupAddress: true, dropoffAddress: true, priceXAF: true } },
      },
    }),
    prisma.issue.count({ where }),
  ]);
  return { items, total };
});

export const resolveIssue = wrap(async (req: Request) =>
  prisma.issue.update({ where: { id: req.params.id }, data: { status: req.body.status ?? 'RESOLVED' } })
);

// ─── Packages (detailed delivery view) ───────────────────────────────────────

export const listPackages = wrap(async (req: Request) => {
  const { q, status, page = 1 } = req.query as any;
  const where: any = {};
  if (status) where.status = status;
  if (q) where.OR = [
    { pickupAddress: { contains: q } },
    { dropoffAddress: { contains: q } },
    { description: { contains: q } },
  ];
  const [items, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25, skip: (Number(page) - 1) * 25,
      include: {
        vendor:    { select: { name: true, phone: true, email: true } },
        deliverer: { select: { name: true, phone: true } },
        locations: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    }),
    prisma.delivery.count({ where }),
  ]);
  return { items, total };
});

export const getPackage = wrap(async (req: Request) =>
  prisma.delivery.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      vendor:    { select: { id: true, name: true, phone: true, email: true } },
      deliverer: { select: { id: true, name: true, phone: true } },
      locations: { orderBy: { createdAt: 'asc' } },
      ratings:   true,
      issues:    { include: { user: { select: { name: true, phone: true } } } },
      escrow:    true,
    },
  })
);

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const listWallets = wrap(async (req: Request) => {
  const { q, page = 1 } = req.query as any;
  const where: any = {};
  if (q) where.user = { OR: [{ name: { contains: q } }, { phone: { contains: q } }] };
  const [items, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      orderBy: { balanceXAF: 'desc' },
      take: 25, skip: (Number(page) - 1) * 25,
      include: {
        user:         { select: { id: true, name: true, phone: true, activeRole: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
        withdrawals:  { orderBy: { createdAt: 'desc' }, take: 3, where: { status: 'PENDING' } },
      },
    }),
    prisma.wallet.count({ where }),
  ]);
  const totalBalance = await prisma.wallet.aggregate({ _sum: { balanceXAF: true } });
  return { items, total, totalBalance: totalBalance._sum.balanceXAF ?? 0 };
});

// ─── Security events ──────────────────────────────────────────────────────────

export const listSecurityEvents = wrap(async (req: Request) => {
  const { page = 1 } = req.query as any;
  // OTP codes represent security events (PIN resets, signups, etc.)
  const [otps, kycUsers] = await Promise.all([
    prisma.otpCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, skip: (Number(page) - 1) * 50,
    }),
    prisma.user.findMany({
      where: { kycStatus: { in: ['PENDING', 'REJECTED'] } },
      select: { id: true, name: true, phone: true, kycStatus: true, createdAt: true, kycDocuments: { select: { type: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { otps, kycUsers };
});

// ─── Admin user creation ──────────────────────────────────────────────────────

export const createUser = wrap(async (req: Request) => {
  const { name, phone, email, pin, role } = req.body;
  if (!name || !phone || !pin || !role) throw new Error('name, phone, pin, role requis');
  const { authService } = await import('../services/auth.service');
  return authService.signup({ name, phone, email, pin, role });
});

// ─── DB Export ───────────────────────────────────────────────────────────────

export const exportDb = async (req: AuthRequest, res: Response) => {
  try {
    const [users, deliveries, transactions, otps, ratings, issues, withdrawals, wallets, archives, settings] = await Promise.all([
      prisma.user.findMany({ include: { kycDocuments: true, wallet: true } }),
      prisma.delivery.findMany({ include: { locations: true, ratings: true, issues: true, escrow: true } }),
      prisma.transaction.findMany(),
      prisma.otpCode.findMany(),
      prisma.rating.findMany(),
      prisma.issue.findMany(),
      prisma.withdrawal.findMany(),
      prisma.wallet.findMany(),
      prisma.dbArchive.findMany({ select: { id: true, label: true, archivedAt: true } }),
      prisma.platformSetting.findMany(),
    ]);

    const snapshot = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      counts: { users: users.length, deliveries: deliveries.length, transactions: transactions.length, wallets: wallets.length },
      users, deliveries, transactions, otps, ratings, issues, withdrawals, wallets, archives, settings,
    };

    const json = JSON.stringify(snapshot, null, 2);
    const filename = `koligo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.status(200).send(json);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

// ─── Wipe Total ───────────────────────────────────────────────────────────────
// Supprime TOUT (y compris users) sauf l'admin appelant + config (villes, settings, archives)

export const wipeTotal = wrap(async (req: AuthRequest) => {
  const adminId = (req as any).user?.userId;
  const label   = req.body.label ?? `WipeTotal ${new Date().toISOString().slice(0, 16)}`;

  // Snapshot complet avant suppression
  const [usersData, deliveriesData, transactionsData, otpsData, ratingsData, issuesData, withdrawalsData, walletsData] = await Promise.all([
    prisma.user.findMany(),
    prisma.delivery.findMany(),
    prisma.transaction.findMany(),
    prisma.otpCode.findMany(),
    prisma.rating.findMany(),
    prisma.issue.findMany(),
    prisma.withdrawal.findMany(),
    prisma.wallet.findMany(),
  ]);

  const counts = {
    users:        usersData.length,
    deliveries:   deliveriesData.length,
    transactions: transactionsData.length,
    wallets:      walletsData.length,
    otps:         otpsData.length,
    date:         new Date().toISOString(),
  };

  await prisma.dbArchive.create({
    data: {
      label: `[WIPE] ${label}`,
      archivedBy: adminId,
      snapshotJson: JSON.stringify({
        ...counts,
        _data: { users: usersData, deliveries: deliveriesData, transactions: transactionsData, otps: otpsData, ratings: ratingsData, issues: issuesData, withdrawals: withdrawalsData, wallets: walletsData },
      }),
    },
  });

  // Suppression en ordre FK-safe
  await prisma.$transaction([
    prisma.gpsLocation.deleteMany(),
    prisma.escrowEntry.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.issue.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.kycDocument.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.user.deleteMany({ where: { id: { not: adminId } } }),
  ]);

  return { wiped: true, snapshot: counts };
});

// ─── DB Archive & Reset ───────────────────────────────────────────────────────

export const archiveAndReset = wrap(async (req: AuthRequest) => {
  const label = req.body.label ?? `Archive ${new Date().toISOString().slice(0, 10)}`;

  // Snapshot full data before delete (for possible restore)
  const [deliveriesData, transactionsData, otpsData, ratingsData, issuesData, withdrawalsData] = await Promise.all([
    prisma.delivery.findMany(),
    prisma.transaction.findMany(),
    prisma.otpCode.findMany(),
    prisma.rating.findMany(),
    prisma.issue.findMany(),
    prisma.withdrawal.findMany(),
  ]);

  const counts = {
    users: await prisma.user.count(),
    deliveries: deliveriesData.length,
    transactions: transactionsData.length,
    otps: otpsData.length,
    date: new Date().toISOString(),
  };

  const snapshotJson = JSON.stringify({
    ...counts,
    _data: { deliveries: deliveriesData, transactions: transactionsData, otps: otpsData, ratings: ratingsData, issues: issuesData, withdrawals: withdrawalsData },
  });

  const archive = await prisma.dbArchive.create({
    data: { label, snapshotJson, archivedBy: (req as any).user?.userId },
  });

  // Delete transactional data (keep users, settings, cities)
  await prisma.$transaction([
    prisma.gpsLocation.deleteMany(),
    prisma.escrowEntry.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.issue.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.otpCode.deleteMany(),
  ]);

  return { archived: true, archiveId: archive.id, snapshot: counts };
});

export const listArchives = wrap(async () =>
  prisma.dbArchive.findMany({
    orderBy: { archivedAt: 'desc' },
    select: { id: true, label: true, archivedAt: true, archivedBy: true, snapshotJson: true },
  })
);

export const restoreArchive = wrap(async (req: Request) => {
  const { id } = req.params;
  const archive = await prisma.dbArchive.findUnique({ where: { id } });
  if (!archive) throw new Error('Archive introuvable');

  let snap: any;
  try { snap = JSON.parse(archive.snapshotJson); } catch { throw new Error('Snapshot corrompu'); }

  const data = snap._data;
  if (!data) throw new Error('Cette archive ne contient pas de données restaurables (ancienne version — comptages uniquement)');

  let restored = { deliveries: 0, transactions: 0, otps: 0 };

  // Re-insert deliveries (skip duplicates by id)
  if (Array.isArray(data.deliveries)) {
    for (const d of data.deliveries) {
      const exists = await prisma.delivery.findUnique({ where: { id: d.id } }).catch(() => null);
      if (!exists) {
        await prisma.delivery.create({ data: d }).catch(() => {});
        restored.deliveries++;
      }
    }
  }
  // Re-insert transactions
  if (Array.isArray(data.transactions)) {
    for (const t of data.transactions) {
      const exists = await prisma.transaction.findUnique({ where: { id: t.id } }).catch(() => null);
      if (!exists) {
        await prisma.transaction.create({ data: t }).catch(() => {});
        restored.transactions++;
      }
    }
  }
  // Re-insert OTPs
  if (Array.isArray(data.otps)) {
    for (const o of data.otps) {
      const exists = await prisma.otpCode.findUnique({ where: { id: o.id } }).catch(() => null);
      if (!exists) {
        await prisma.otpCode.create({ data: o }).catch(() => {});
        restored.otps++;
      }
    }
  }

  return { restored: true, archiveId: id, counts: restored };
});
