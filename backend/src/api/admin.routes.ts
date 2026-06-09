import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import * as ctrl from '../controllers/admin.controller';

const router = Router();
router.use(verifyJWT, requireRole('ADMIN'));

router.get('/stats', ctrl.getStats);
router.get('/users', ctrl.listUsers);
router.get('/users/:id', ctrl.getUser);
router.patch('/users/:id/block', ctrl.blockUser);
router.patch('/users/:id/kyc', ctrl.reviewKyc);
router.get('/deliveries', ctrl.listDeliveries);
router.patch('/deliveries/:id/cancel', ctrl.cancelDelivery);
router.get('/settings', ctrl.getSettings);
router.patch('/settings', ctrl.updateSetting);

export default router;
