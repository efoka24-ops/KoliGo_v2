import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { requireKyc } from '../middleware/kyc.middleware';
import * as ctrl from '../controllers/delivery.controller';

const router = Router();

// ── Public routes (no JWT) ────────────────────────────────────────────────────
// Client tracking — JWT embedded in token param
router.get('/track/:clientToken', ctrl.trackByClientToken);
// Recipient payment at delivery
router.post('/client-pay', ctrl.clientPay);
router.get('/client-payment-status', ctrl.clientPaymentStatus);
router.post('/client-rate', ctrl.clientRate);
router.post('/client-report', ctrl.clientReport);
// Recipient confirms delivery by code (mock or real payment)
router.post('/:id/client-confirm', ctrl.clientConfirm);
// Recipient chat message via tracking page (no auth)
router.post('/:id/recipient-message', ctrl.sendRecipientMessage);
// Public read-only message list for tracking page
router.get('/:id/messages-public', ctrl.listMessagesPublic);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(verifyJWT);

// Vendor
router.post('/', requireRole('VENDOR'), ctrl.create);
router.get('/', ctrl.list);
router.patch('/:id/cancel', requireRole('VENDOR'), ctrl.cancel);
router.get('/:id/trust-invoice', requireRole('VENDOR'), ctrl.trustInvoice);

// Deliverer: open offers
router.get('/available', requireRole('DELIVERER'), ctrl.listAvailable);

// Any auth user
router.get('/:id', ctrl.getById);
router.patch('/:id/accept', requireRole('DELIVERER'), ctrl.accept);
router.patch('/:id/confirm-collect', requireRole('DELIVERER'), ctrl.confirmCollect);
router.patch('/:id/confirm-deliver', requireRole('DELIVERER'), ctrl.confirmDeliver);
router.post('/:id/location', requireRole('DELIVERER'), ctrl.postLocation);
router.get('/:id/location', ctrl.getLocation);
// Delivery chat
router.get('/:id/messages', ctrl.listMessages);
router.post('/:id/messages', ctrl.sendMessage);

export default router;
