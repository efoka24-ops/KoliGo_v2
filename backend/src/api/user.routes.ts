import { Router } from 'express';
import multer from 'multer';
import { verifyJWT } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/auth.controller';

const upload = multer({ dest: process.env.UPLOAD_DIR ?? './uploads' });
const router = Router();

router.use(verifyJWT);
router.get('/profile', ctrl.getProfile);
router.patch('/profile', ctrl.updateProfile);
router.patch('/payment-account', ctrl.updatePaymentAccount);
router.post('/kyc', upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]), ctrl.submitKyc);

export default router;
