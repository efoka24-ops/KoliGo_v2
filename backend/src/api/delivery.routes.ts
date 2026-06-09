import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { requireKyc } from '../middleware/kyc.middleware';
import * as ctrl from '../controllers/delivery.controller';

const router = Router();

// Client tracking — no auth (JWT embedded in token param)
router.get('/track/:clientToken', ctrl.trackByClientToken);

router.use(verifyJWT);

// Vendor
router.post('/', requireRole('VENDOR'), requireKyc, ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.patch('/:id/cancel', requireRole('VENDOR'), ctrl.cancel);

// Deliverer
router.patch('/:id/accept', requireRole('DELIVERER'), requireKyc, ctrl.accept);
router.patch('/:id/confirm-collect', requireRole('DELIVERER'), ctrl.confirmCollect);
router.patch('/:id/confirm-deliver', requireRole('DELIVERER'), ctrl.confirmDeliver);
router.post('/:id/location', requireRole('DELIVERER'), ctrl.postLocation);
router.get('/:id/location', ctrl.getLocation);

export default router;
