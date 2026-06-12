import { Router } from 'express';
import { prisma } from '../models/prisma';
import { computeDistanceKm } from '../utils/distance';

const router = Router();

// Cities and neighborhoods — publicly accessible for delivery address selection
router.get('/cities', async (_req, res) => {
  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
      include: {
        neighborhoods: { where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, latitude: true, longitude: true } },
      },
    });
    res.json(cities);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Pricing config — no auth needed so the app can compute delivery prices before login
router.get('/pricing', (_req, res) => {
  res.json({
    baseRate: parseInt(process.env.PRICING_BASE_RATE ?? '300'),
    perKmRate: parseInt(process.env.PRICING_PER_KM ?? '150'),
    minPrice: parseInt(process.env.PRICING_MIN ?? '1000'),
    weightSurcharge: parseInt(process.env.PRICING_WEIGHT_SURCHARGE ?? '100'),
    commissionRate: parseInt(process.env.PRICING_COMMISSION ?? '15'),
  });
});

// Real road distance between two Cameroon addresses — used for price estimation before delivery creation
router.get('/distance', async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from et to requis' }); return; }
  try {
    const km = await computeDistanceKm(from, to);
    res.json({ km });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
