import { Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
import { geoService } from '../services/geo.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { verifyAccess } from '../utils/jwt';
import { prisma } from '../models/prisma';
import { paymentService } from '../services/payment.service';

const wrap = (fn: Function) => async (req: Request, res: Response) => {
  try { res.json(await fn(req, res)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const create = wrap(async (req: AuthRequest) => {
  const b = req.body;
  const payload = {
    pickupAddress:   b.pickupAddress  ?? b.fromQuartier ?? b.from ?? '',
    dropoffAddress:  b.dropoffAddress ?? b.toQuartier   ?? b.to   ?? '',
    weightKg:        b.weightKg       ?? b.weight       ?? 1,
    description:     b.description    ?? b.parcelDesc,
    delivererType:   b.delivererType  ?? b.courierType  ?? 'TEMPORAIRE',
    distanceKm:      b.distanceKm     ?? b.distance     ?? 2,
    shopName:        b.shopName,
    recipientName:   b.recipientName,
    recipientPhone:  b.recipientPhone,
    productPriceXAF: b.productPrice   ?? b.productPriceXAF ?? 0,
  };
  if (!payload.pickupAddress || !payload.dropoffAddress) throw new Error('fromQuartier et toQuartier requis');
  return deliveryService.create(req.user!.userId, payload);
});

export const list = wrap(async (req: AuthRequest) => {
  const { status, page = 1 } = req.query as any;
  return prisma.delivery.findMany({
    where: { OR: [{ vendorId: req.user!.userId }, { delivererId: req.user!.userId }], ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    skip: (page - 1) * 20,
    include: {
      vendor:    { select: { name: true } },
      deliverer: { select: { name: true, phone: true } },
    },
  });
});

export const listAvailable = wrap(async (_req: AuthRequest) =>
  prisma.delivery.findMany({
    where: { status: 'EN_ATTENTE', delivererId: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { vendor: { select: { name: true } } },
  })
);

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
    select: {
      id: true, status: true, pickupAddress: true, dropoffAddress: true,
      deliverCode: true, priceXAF: true, productPriceXAF: true,
      shopName: true, recipientName: true,
      deliverer: { select: { name: true, phone: true, cniNumber: true, quartier: true } },
    },
  });
});

// GET /deliveries/:id/trust-invoice — vendor only, returns deliverer info for trust receipt
export const trustInvoice = wrap(async (req: AuthRequest) => {
  const d = await prisma.delivery.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      deliverer: { select: { id: true, name: true, phone: true, cniNumber: true, quartier: true, kycStatus: true } },
    },
  });
  if (d.vendorId !== req.user!.userId) throw new Error('Forbidden');
  if (!d.delivererId || !d.deliverer) throw new Error('Aucun livreur assigné pour l\'instant');
  return {
    deliveryId:       d.id,
    pickupAddress:    d.pickupAddress,
    dropoffAddress:   d.dropoffAddress,
    priceXAF:         d.priceXAF,
    status:           d.status,
    recipientName:    d.recipientName    ?? null,
    recipientPhone:   d.recipientPhone   ?? null,
    recipientAddress: d.dropoffAddress   ?? null,
    deliverer: {
      id:        d.deliverer.id,
      name:      d.deliverer.name,
      phone:     d.deliverer.phone,
      cniNumber: d.deliverer.cniNumber ?? 'Non renseigné',
      quartier:  d.deliverer.quartier  ?? 'Non renseigné',
      kycStatus: d.deliverer.kycStatus ?? 'NONE',
    },
  };
});

// POST /deliveries/client-pay — public, recipient pays at delivery (clientToken in body)
export const clientPay = wrap(async (req: Request) => {
  const { clientToken, deliverCode, momoPhone } = req.body;
  if (!clientToken || !deliverCode || !momoPhone) throw new Error('clientToken, deliverCode et momoPhone requis');

  const phoneNorm = momoPhone.replace(/\s/g, '');
  if (!/^6\d{8}$/.test(phoneNorm)) throw new Error('Numéro MoMo invalide (format: 6XXXXXXXX)');

  let payload: any;
  try { payload = verifyAccess(clientToken); }
  catch { throw new Error('Lien de suivi invalide ou expiré'); }

  const deliveryId = (payload as any).deliveryId;
  const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });

  if (d.deliverCode !== deliverCode) throw new Error('Code de réception invalide');
  if (d.status !== 'EN_ROUTE') throw new Error(`La livraison ne peut pas être payée en statut ${d.status}`);

  // ── Mode test/mock (PAYMENT_MOCK=true dans .env) ──
  if (process.env.PAYMENT_MOCK === 'true') {
    const mockId = `MOCK-${Date.now()}`;
    await prisma.delivery.update({ where: { id: deliveryId }, data: { momoRef: mockId } });
    return { transactionId: mockId, extRef: mockId, amount: d.priceXAF, mock: true };
  }

  const extRef = `KOLIGOCLI${deliveryId.slice(-6)}${Date.now()}`;
  const BASE   = process.env.APP_BASE_URL ?? 'http://localhost:3000';

  let result: any;
  try {
    result = await paymentService.cashout({
      amount:            d.priceXAF,
      phoneNumber:       phoneNorm,
      externalReference: extRef,
      notificationUrl:   `${BASE}/payment/webhook`,
      description:       `KoliGo livraison #${deliveryId.slice(-6)} · ${d.pickupAddress} → ${d.dropoffAddress}`,
    });
  } catch (err: any) {
    const msg  = err.response?.data?.message ?? err.response?.data?.error ?? err.message;
    const code = err.response?.status ?? 0;
    throw new Error(`Paiement MoMo échoué (${paymentService.name} ${code}): ${msg}`);
  }

  await prisma.delivery.update({ where: { id: deliveryId }, data: { momoRef: result.transactionId || extRef } });

  return { transactionId: result.transactionId || extRef, extRef, amount: d.priceXAF };
});

// GET /deliveries/client-payment-status?transactionId=&clientToken= — poll + confirm on success
export const clientPaymentStatus = wrap(async (req: Request) => {
  const { transactionId, clientToken } = req.query as any;
  if (!transactionId || !clientToken) throw new Error('transactionId et clientToken requis');

  let payload: any;
  try { payload = verifyAccess(clientToken); }
  catch { throw new Error('Lien de suivi invalide ou expiré'); }
  const deliveryId = (payload as any).deliveryId;

  // ── Mode mock : auto-confirme après 5 secondes ──
  if (String(transactionId).startsWith('MOCK-')) {
    const ts = parseInt(String(transactionId).replace('MOCK-', ''), 10);
    if (Date.now() - ts > 5000) {
      await deliveryService.confirmDeliverByPayment(deliveryId, transactionId).catch(() => {});
      const dm = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { deliverer: { select: { name: true, phone: true } }, vendor: { select: { name: true } } },
      });
      return { status: 'success', amount: dm?.priceXAF ?? 0, delivery: dm, mock: true };
    }
    return { status: 'pending', mock: true };
  }

  let settled = false;
  let failed = false;
  let amount = 0;
  try {
    const result = await paymentService.verify(transactionId);
    // Status vocabulary differs per provider — let the provider judge.
    settled = paymentService.isSettled(result.status);
    failed = paymentService.isFailed(result.status);
    amount = result.amount ?? 0;
  } catch {
    return { status: 'pending' };
  }

  if (settled) {
    await deliveryService.confirmDeliverByPayment(deliveryId, transactionId).catch(() => {});
    const d = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { deliverer: { select: { name: true, phone: true } }, vendor: { select: { name: true } } },
    });
    return {
      status:   'success',
      amount,
      delivery: d,
    };
  }

  if (failed) {
    return { status: 'failed' };
  }

  return { status: 'pending' };
});

// POST /deliveries/client-rate — public, recipient rates the deliverer
export const clientRate = wrap(async (req: Request) => {
  const { clientToken, score, tags, comment } = req.body;
  if (!clientToken || !score) throw new Error('clientToken et score requis');

  let payload: any;
  try { payload = verifyAccess(clientToken); }
  catch { throw new Error('Lien de suivi invalide'); }
  const deliveryId = (payload as any).deliveryId;

  const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  if (!d.delivererId) throw new Error('Aucun livreur assigné');
  if (d.status !== 'LIVRE') throw new Error('La livraison n\'est pas encore terminée');

  // Check if already rated by client (avoid duplicates)
  const existing = await prisma.rating.findFirst({ where: { deliveryId, fromUserId: d.vendorId } });
  if (existing) return { ok: true, alreadyRated: true };

  await prisma.rating.create({
    data: {
      deliveryId,
      fromUserId: d.vendorId,
      toUserId:   d.delivererId,
      score:      Math.min(5, Math.max(1, Number(score))),
      tags:       tags ? JSON.stringify(tags) : null,
      comment,
    },
  });
  return { ok: true };
});

// POST /deliveries/:id/client-confirm — public, recipient confirms delivery with code B
export const clientConfirm = wrap(async (req: Request) => {
  const { code, momoPhone, paymentNumber } = req.body;
  if (!code) throw new Error('code requis');

  const d = await prisma.delivery.findUniqueOrThrow({ where: { id: req.params.id } });
  if (d.deliverCode !== code) throw new Error('Code de réception invalide');
  if (d.status !== 'EN_ROUTE') throw new Error(`Statut incorrect: ${d.status}`);

  const phone = (momoPhone || paymentNumber || '').replace(/\s/g, '');

  if (process.env.PAYMENT_MOCK === 'true') {
    const mockRef = `MOCK-CLIENT-${Date.now()}`;
    await deliveryService.confirmDeliverByPayment(d.id, mockRef);
    return {
      ok: true,
      delivererName: null,
      delivererId: d.delivererId,
      vendorName: d.shopName ?? null,
      parcelDesc: d.description ?? null,
      productPrice: d.productPriceXAF,
      price: d.priceXAF,
    };
  }

  // Real payment flow: initiate cashout
  if (!phone) throw new Error('Numéro de paiement MoMo requis');
  if (!/^6\d{8}$/.test(phone)) throw new Error('Numéro MoMo invalide (format: 6XXXXXXXX)');

  const extRef = `KOLIGOCLI${d.id.slice(-6)}${Date.now()}`;
  const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000';

  let result: any;
  try {
    result = await paymentService.cashout({
      amount: d.priceXAF,
      phoneNumber: phone,
      externalReference: extRef,
      notificationUrl: `${BASE}/payment/webhook`,
      description: `KoliGo livraison #${d.id.slice(-6)} · ${d.pickupAddress} → ${d.dropoffAddress}`,
    });
  } catch (err: any) {
    const msg = err.response?.data?.message ?? err.message;
    throw new Error(`Paiement MoMo échoué: ${msg}`);
  }

  const transactionId = result.transactionId || extRef;
  await prisma.delivery.update({ where: { id: d.id }, data: { momoRef: transactionId } });
  return { ok: true, transactionId, pending: true };
});

// POST /deliveries/client-report — public, recipient reports an issue
export const clientReport = wrap(async (req: Request) => {
  const { clientToken, type, description } = req.body;
  if (!clientToken || !type) throw new Error('clientToken et type requis');

  let payload: any;
  try { payload = verifyAccess(clientToken); }
  catch { throw new Error('Lien de suivi invalide'); }
  const deliveryId = (payload as any).deliveryId;

  const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });

  await prisma.issue.create({
    data: {
      deliveryId,
      userId:      d.vendorId,
      type,
      description: description ?? null,
    },
  });
  return { ok: true };
});

// GET /deliveries/:id/messages-public — read-only for recipient tracking page (no auth)
export const listMessagesPublic = wrap(async (req: Request) => {
  return prisma.message.findMany({
    where: { deliveryId: req.params.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, senderName: true, senderRole: true, content: true, createdAt: true },
  });
});

// GET /deliveries/:id/messages — all chat messages for a delivery (auth required)
export const listMessages = wrap(async (req: AuthRequest) => {
  const { id } = req.params;
  // Verify the user is involved in this delivery
  const d = await prisma.delivery.findUniqueOrThrow({ where: { id }, select: { vendorId: true, delivererId: true } });
  const uid = req.user!.userId;
  if (d.vendorId !== uid && d.delivererId !== uid) throw new Error('Accès refusé');
  return prisma.message.findMany({
    where: { deliveryId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, senderId: true, senderName: true, senderRole: true, content: true, createdAt: true },
  });
});

// POST /deliveries/:id/messages — send a message (auth required — vendor or deliverer)
export const sendMessage = wrap(async (req: AuthRequest) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content?.trim()) throw new Error('Message vide');
  const d = await prisma.delivery.findUniqueOrThrow({
    where: { id },
    select: { vendorId: true, delivererId: true, vendor: { select: { name: true } }, deliverer: { select: { name: true } } },
  });
  const uid = req.user!.userId;
  const isVendor    = d.vendorId === uid;
  const isDeliverer = d.delivererId === uid;
  if (!isVendor && !isDeliverer) throw new Error('Accès refusé');
  const senderRole = isVendor ? 'vendor' : 'deliverer';
  const senderName = isVendor ? (d.vendor?.name ?? 'Vendeur') : (d.deliverer?.name ?? 'Livreur');
  return prisma.message.create({
    data: { deliveryId: id, senderId: uid, senderName, senderRole, content: content.trim() },
    select: { id: true, senderId: true, senderName: true, senderRole: true, content: true, createdAt: true },
  });
});

// POST /deliveries/:id/recipient-message — public, recipient sends message via delivery ID
export const sendRecipientMessage = wrap(async (req: Request) => {
  const { id } = req.params;
  const { content, recipientName } = req.body;
  if (!content?.trim()) throw new Error('Message vide');
  const d = await prisma.delivery.findUniqueOrThrow({
    where: { id },
    select: { recipientName: true, status: true },
  });
  if (['EN_ATTENTE', 'ANNULE'].includes(d.status)) throw new Error('La livraison n\'est pas encore en cours');
  const name = recipientName?.trim() || d.recipientName || 'Destinataire';
  return prisma.message.create({
    data: { deliveryId: id, senderId: null, senderName: name, senderRole: 'recipient', content: content.trim() },
    select: { id: true, senderName: true, senderRole: true, content: true, createdAt: true },
  });
});
