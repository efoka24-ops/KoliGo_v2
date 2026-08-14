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

// Public landing pages after redirect
router.get('/success', (_req, res) => res.send('<h2 style="font-family:sans-serif;color:#178A3C;">✅ Paiement confirmé. Revenez dans l\'application KoliGo.</h2>'));
router.get('/cancel',  (_req, res) => res.send('<h2 style="font-family:sans-serif;color:#E8551C;">❌ Paiement annulé. Revenez dans l\'application KoliGo.</h2>'));

export default router;
