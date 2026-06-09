import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/otp/send', ctrl.sendOtp);
router.post('/otp/verify', ctrl.verifyOtp);
router.post('/signup', ctrl.signup);
router.post('/signin', ctrl.signin);
router.post('/refresh', ctrl.refresh);
router.post('/switch-role', verifyJWT, ctrl.switchRole);

export default router;
