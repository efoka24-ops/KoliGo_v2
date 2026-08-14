import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/wallet.controller';

const router = Router();
router.use(verifyJWT);
router.get('/', ctrl.getBalance);
router.get('/transactions', ctrl.getTransactions);
router.post('/topup', ctrl.topUp);
router.post('/withdraw', ctrl.withdraw);

export default router;
