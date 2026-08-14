import { Router, Request, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { paymentService } from '../services/payment.service';
import { prisma } from '../models/prisma';

const router = Router();

const NOTIFY_BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000';

// POST /payment/cashout — initiate MoMo payment for a delivery
router.post('/cashout', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { deliveryId, phone } = req.body;
    if (!deliveryId || !phone) {
      res.status(400).json({ error: 'deliveryId et phone requis' }); return;
    }
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) { res.status(404).json({ error: 'Livraison introuvable' }); return; }
    if (delivery.vendorId !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const extRef = `KOLIGO-${deliveryId.slice(-8)}-${Date.now()}`;

    const result = await paymentService.cashout({
      amount:            delivery.priceXAF,
      phoneNumber:       phone,
      externalReference: extRef,
      notificationUrl:   `${NOTIFY_BASE}/payment/webhook`,
      description:       `KoliGo livraison #${deliveryId.slice(-6)} · ${delivery.pickupAddress} → ${delivery.dropoffAddress}`,
    });

    // Save the provider transaction id on the delivery
    await prisma.delivery.update({
      where: { id: deliveryId },
      data:  { momoRef: result.transactionId || extRef },
    });

    res.json({ transactionId: result.transactionId, extRef, status: result.status, network: result.network });
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message ?? e.message });
  }
});

// GET /payment/verify/:id — poll Camoo transaction status
router.get('/verify/:id', verifyJWT, async (req: Request, res: Response) => {
  try {
    const result = await paymentService.verify(req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message ?? e.message });
  }
});

// GET /payment/balance — admin: check Camoo account balance
router.get('/balance', verifyJWT, async (_req: Request, res: Response) => {
  try {
    const result = await paymentService.getBalance();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data?.message ?? e.message });
  }
});

// POST /payment/webhook — Camoo async notification (no auth — signed via HMAC)
router.get('/webhook', async (req: Request, res: Response) => {
  try {
    const valid = paymentService.verifyWebhookSignature(req.query as Record<string, string>);
    if (!valid) { res.status(400).json({ error: 'Invalid signature' }); return; }

    const { id, status, external_reference } = req.query as Record<string, string>;
    const s = (status ?? '').toLowerCase();

    if ((s === 'success' || s === 'completed') && id) {
      // Client payment at delivery — find delivery by momoRef and confirm it
      const d = await prisma.delivery.findFirst({
        where: { OR: [{ momoRef: id }, { momoRef: external_reference }] },
      });
      if (d && d.status === 'EN_ROUTE') {
        const { deliveryService } = await import('../services/delivery.service');
        await deliveryService.confirmDeliverByPayment(d.id, id).catch(() => {});
      }
    }
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// POST /payment/webhook/apisungku — statut final d'un paiement.
// Pas d'authentification : l'appel est signe en HMAC sur le corps brut.
router.post('/webhook/apisungku', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    const valid = paymentService.verifyWebhookSignature(
      req.headers as Record<string, string>,
      rawBody
    );
    if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return; }

    const { data } = req.body as { data: any };
    const reference = String(data?.reference ?? '');
    const status = String(data?.status ?? '');

    // Issue indeterminee : l'argent a peut-etre bouge. On ne conclut jamais
    // automatiquement, on laisse une trace pour un examen humain.
    if (paymentService.needsAttention?.(status)) {
      console.error(
        `[payment] ${data?.type} ${data?.id} en NEEDS_ATTENTION (ref ${reference}) — verification manuelle requise`
      );
      res.json({ ok: true }); return;
    }

    // La reference que nous avons emise porte le type d'operation : elle suffit
    // a router l'evenement sans interroger plusieurs tables a l'aveugle.
    if (reference.startsWith('KOLIGO-TOPUP-')) {
      await traiterRechargement(reference, status, data);
    } else if (reference.startsWith('KOLIGO-WITHDRAW-')) {
      await traiterRetrait(reference, status);
    } else {
      await traiterLivraison(reference, status, data);
    }

    // Toujours 2xx apres traitement : un statut d'erreur declencherait des
    // reessais alors que l'evenement a bien ete pris en compte.
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[payment] webhook apisungku:', e.message);
    res.json({ ok: true });
  }
});

/**
 * Rechargement : le solde n'est credite qu'ici, une fois le paiement abouti.
 *
 * Le filtre `status: 'PENDING'` de la mise a jour est ce qui rend l'operation
 * idempotente : un webhook rejoue ne trouve plus de ligne en attente et ne
 * credite donc pas une seconde fois.
 */
async function traiterRechargement(reference: string, status: string, data: any) {
  const topUp = await prisma.topUp.findUnique({ where: { externalRef: reference } });
  if (!topUp || topUp.status !== 'PENDING') return;

  if (paymentService.isSettled(status)) {
    await prisma.$transaction([
      prisma.topUp.updateMany({
        where: { id: topUp.id, status: 'PENDING' },
        data: { status: 'SUCCESS', paymentId: data?.id ?? null },
      }),
      prisma.wallet.update({
        where: { id: topUp.walletId },
        data: { balanceXAF: { increment: topUp.amountXAF } },
      }),
      prisma.transaction.create({
        data: {
          walletId: topUp.walletId,
          type: 'TOPUP',
          amountXAF: topUp.amountXAF,
          description: 'Rechargement mobile money',
        },
      }),
    ]);
  } else if (paymentService.isFailed(status)) {
    // Aucun mouvement de fonds : rien a rembourser, le solde n'a jamais bouge.
    await prisma.topUp.updateMany({
      where: { id: topUp.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
}

/**
 * Retrait : le solde a deja ete debite a l'initiation. Un echec doit donc le
 * recrediter, sans quoi l'utilisateur perdrait son argent.
 */
async function traiterRetrait(reference: string, status: string) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { externalRef: reference } });
  if (!withdrawal || withdrawal.status !== 'PENDING') return;

  if (paymentService.isSettled(status)) {
    await prisma.withdrawal.updateMany({
      where: { id: withdrawal.id, status: 'PENDING' },
      data: { status: 'SUCCESS' },
    });
  } else if (paymentService.isFailed(status)) {
    await prisma.$transaction([
      prisma.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      }),
      prisma.wallet.update({
        where: { id: withdrawal.walletId },
        data: { balanceXAF: { increment: withdrawal.amountXAF } },
      }),
      prisma.transaction.create({
        data: {
          walletId: withdrawal.walletId,
          type: 'REFUND',
          amountXAF: withdrawal.amountXAF,
          description: 'Retrait echoue — solde restitue',
        },
      }),
    ]);
  }
}

/** Paiement d'une livraison par le client. */
async function traiterLivraison(reference: string, status: string, data: any) {
  const delivery = await prisma.delivery.findFirst({
    where: { OR: [{ momoRef: reference }, { momoRef: data?.id ?? '' }] },
  });
  if (!delivery) return;

  if (data?.type === 'DEPOSIT' && paymentService.isSettled(status) && delivery.status === 'EN_ROUTE') {
    const { deliveryService } = await import('../services/delivery.service');
    await deliveryService.confirmDeliverByPayment(delivery.id, data.id).catch(() => {});
  }
}

// Public landing pages after redirect
router.get('/success', (_req, res) => res.send('<h2 style="font-family:sans-serif;color:#178A3C;">✅ Paiement confirmé. Revenez dans l\'application KoliGo.</h2>'));
router.get('/cancel',  (_req, res) => res.send('<h2 style="font-family:sans-serif;color:#E8551C;">❌ Paiement annulé. Revenez dans l\'application KoliGo.</h2>'));

export default router;
