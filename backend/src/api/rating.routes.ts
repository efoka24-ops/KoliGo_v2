import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/rating.controller';

const router = Router();
router.use(verifyJWT);
router.post('/', ctrl.postRating);

export default router;
