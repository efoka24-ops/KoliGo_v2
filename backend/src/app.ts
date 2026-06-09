import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './api/auth.routes';
import userRoutes from './api/user.routes';
import deliveryRoutes from './api/delivery.routes';
import walletRoutes from './api/wallet.routes';
import ratingRoutes from './api/rating.routes';
import issueRoutes from './api/issue.routes';
import adminRoutes from './api/admin.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true }));

  app.use('/auth', authRoutes);
  app.use('/user', userRoutes);
  app.use('/deliveries', deliveryRoutes);
  app.use('/wallet', walletRoutes);
  app.use('/ratings', ratingRoutes);
  app.use('/issues', issueRoutes);
  app.use('/admin', adminRoutes);

  app.get('/health', (_, res) => res.json({ ok: true }));

  return app;
}
