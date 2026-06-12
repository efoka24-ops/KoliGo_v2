import { Router } from 'express';
import multer from 'multer';
import { verifyJWT } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/auth.controller';

const router = Router();
const upload = multer({ dest: process.env.UPLOAD_DIR ?? './uploads' });

router.post('/otp/send', ctrl.sendOtp);
router.post('/otp/verify', ctrl.verifyOtp);
router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
router.post('/signup', ctrl.signup);
router.post('/signin', ctrl.signin);
router.post('/refresh', ctrl.refresh);
router.post('/switch-role', verifyJWT, ctrl.switchRole);
router.post('/forgot-pin', ctrl.forgotPin);
router.post('/reset-pin', ctrl.resetPin);
router.post('/device-session', (_req, res) => res.json({ ok: true }));
// KYC submission — mobile sends JSON base64; also handles multipart for web
router.post('/kyc', verifyJWT, upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack',  maxCount: 1 },
  { name: 'selfie',  maxCount: 1 },
]), ctrl.submitKyc);
// Also expose on /profile and /user/kyc alias for completeness
router.get('/profile',  verifyJWT, ctrl.getProfile);
router.patch('/profile', verifyJWT, ctrl.updateProfile);

export default router;
