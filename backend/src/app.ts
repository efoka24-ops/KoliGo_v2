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
import publicRoutes from './api/public.routes';
import paymentRoutes from './api/payment.routes';
import trackRoutes from './api/track.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true }));

  // Routes mounted at /api/ — mobile app uses this prefix universally
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/ratings', ratingRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/payment', paymentRoutes);
  // Legacy aliases (no prefix) — kept for backward compat with mobile app
  app.use('/auth', authRoutes);
  app.use('/user', userRoutes);
  app.use('/public', publicRoutes);
  app.use('/admin', adminRoutes);
  app.use('/deliveries', deliveryRoutes);
  app.use('/wallet', walletRoutes);
  app.use('/ratings', ratingRoutes);
  app.use('/issues', issueRoutes);

  // Public tracking page — served as HTML for recipients who receive the link via SMS/WhatsApp
  // Override Helmet's strict CSP for this route: page uses inline scripts + styles (standalone HTML, no CDN)
  app.use('/track', (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self' *"
    );
    next();
  });
  app.use('/track', trackRoutes);

  app.get('/health', (_, res) => res.json({ ok: true }));

  return app;
}
