import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

async function main() {
  console.log('Seeding KoliGo database…');

  // ── Platform settings ───────────────────────────────────────────────────────
  const settings = [
    { key: 'commission_rate', value: '0.03' },
    { key: 'base_rate_xaf', value: '500' },
    { key: 'per_km_rate_xaf', value: '150' },
    { key: 'weight_surcharge_xaf', value: '100' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'min_withdrawal_xaf', value: '1000' },
    { key: 'gps_interval_ms', value: '8000' },
    { key: 'otp_ttl_minutes', value: '5' },
    { key: 'otp_max_attempts', value: '3' },
  ];
  for (const s of settings) {
    await prisma.platformSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { phone: '+237600000001' },
    update: {},
    create: {
      phone: '+237600000001',
      name: 'Admin KoliGo',
      pinHash: hashPin('1234'),
      roles: JSON.stringify(['ADMIN']),
      activeRole: 'ADMIN',
      kycStatus: 'VERIFIED',
      wallet: { create: { balanceXAF: 0, paymentProvider: 'MTN' } },
    },
  });

  // ── Vendors ─────────────────────────────────────────────────────────────────
  const vendorData = [
    { phone: '+237655111222', name: 'Marie Ngono' },
    { phone: '+237677333444', name: 'Cécile Biya' },
    { phone: '+237690555666', name: 'Boutique Mado' },
  ];
  const vendors = await Promise.all(
    vendorData.map(v =>
      prisma.user.upsert({
        where: { phone: v.phone },
        update: {},
        create: {
          ...v,
          pinHash: hashPin('1234'),
          roles: JSON.stringify(['VENDOR']),
          activeRole: 'VENDOR',
          kycStatus: 'VERIFIED',
          wallet: { create: { balanceXAF: 0, paymentProvider: 'MTN' } },
        },
      })
    )
  );

  // ── Deliverers ──────────────────────────────────────────────────────────────
  const delivererData = [
    { phone: '+237677234567', name: 'Hervé Nkouamba', balance: 12500 },
    { phone: '+237655456789', name: 'Marc Tchioffo', balance: 8750 },
    { phone: '+237677567890', name: 'Paul Kamga', balance: 21000 },
  ];
  const deliverers = await Promise.all(
    delivererData.map(d =>
      prisma.user.upsert({
        where: { phone: d.phone },
        update: {},
        create: {
          phone: d.phone,
          name: d.name,
          pinHash: hashPin('1234'),
          roles: JSON.stringify(['DELIVERER']),
          activeRole: 'DELIVERER',
          kycStatus: 'VERIFIED',
          wallet: { create: { balanceXAF: d.balance, paymentProvider: 'MTN' } },
        },
      })
    )
  );

  // ── Sample deliveries ───────────────────────────────────────────────────────
  const price1 = 2125;
  const commission1 = Math.round(price1 * 0.03);
  await prisma.delivery.upsert({
    where: { clientToken: 'seed-token-001' },
    update: {},
    create: {
      vendorId: vendors[0].id,
      delivererId: deliverers[0].id,
      pickupAddress: 'Bonapriso, Rue des Brasseries',
      dropoffAddress: 'Logpom, Carrefour Shell',
      weightKg: 2.0,
      description: 'Commande vêtements',
      delivererType: 'EXPRESS',
      status: 'EN_ROUTE',
      collectCode: '4821',
      deliverCode: '7359',
      clientToken: 'seed-token-001',
      priceXAF: price1,
      commissionXAF: commission1,
      delivererEarning: price1 - commission1,
      escrow: { create: { amountXAF: price1 } },
    },
  });

  const price2 = 4865;
  const commission2 = Math.round(price2 * 0.03);
  await prisma.delivery.upsert({
    where: { clientToken: 'seed-token-002' },
    update: {},
    create: {
      vendorId: vendors[1].id,
      pickupAddress: 'Bali, Avenue Winston Churchill',
      dropoffAddress: 'PK14, Rond-Point Université',
      weightKg: 5.0,
      description: 'Électronique fragile',
      delivererType: 'VVIP',
      status: 'EN_ATTENTE',
      collectCode: '1234',
      deliverCode: '5678',
      clientToken: 'seed-token-002',
      priceXAF: price2,
      commissionXAF: commission2,
      delivererEarning: price2 - commission2,
      escrow: { create: { amountXAF: price2 } },
    },
  });

  console.log('✅ Seed complete.');
  console.log('👤 PIN for all test accounts: 1234');
  console.log('📱 Vendor:    +237655111222');
  console.log('🏍️  Deliverer: +237677234567');
  console.log('🔑 Admin:     +237600000001');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
