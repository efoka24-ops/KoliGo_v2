import { Router } from 'express';
import multer from 'multer';
import { verifyJWT } from '../middleware/auth.middleware';

const upload = multer({ dest: process.env.UPLOAD_DIR ?? './uploads' });
const router = Router();

router.use(verifyJWT);
router.post('/', upload.array('photos', 3), async (req, res) => {
  // TODO: implement issue controller
  res.status(201).json({ ok: true });
});

export default router;
