import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const ROUNDS = 10;

async function main() {
  console.log('Seeding KoliGo database…');

  // ── Platform settings ───────────────────────────────────────────────────────
  const settings = [
    { key: 'commission_rate',     value: '0.03'  },
    { key: 'base_rate_xaf',       value: '500'   },
    { key: 'per_km_rate_xaf',     value: '150'   },
    { key: 'weight_surcharge_xaf',value: '100'   },
    { key: 'maintenance_mode',    value: 'false' },
    { key: 'min_withdrawal_xaf',  value: '1000'  },
    { key: 'gps_interval_ms',     value: '8000'  },
    { key: 'otp_ttl_minutes',     value: '5'     },
    { key: 'otp_max_attempts',    value: '3'     },
    { key: 'express_multiplier',  value: '1.5'   },
    { key: 'vvip_multiplier',     value: '2.5'   },
    { key: 'sms_notifications',   value: 'true'  },
  ];
  for (const s of settings) {
    await prisma.platformSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  const pin1234 = await bcrypt.hash('1234', ROUNDS);
  const pin0000 = await bcrypt.hash('0000', ROUNDS);

  // ── Admin ───────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { phone: '+237600000001' },
    update: { pinHash: pin1234 },
    create: {
      phone:      '+237600000001',
      name:       'Admin KoliGo',
      email:      'admin@koligo.cm',
      pinHash:    pin1234,
      roles:      JSON.stringify(['ADMIN']),
      activeRole: 'ADMIN',
      kycStatus:  'VERIFIED',
      wallet: { create: { balanceXAF: 0, paymentProvider: 'MTN' } },
    },
  });

  // ── Vendors ─────────────────────────────────────────────────────────────────
  const vendorData = [
    { phone: '+237655111222', name: 'Marie Ngono',    balance: 15000 },
    { phone: '+237677333444', name: 'Cécile Biya',    balance: 8200  },
    { phone: '+237690555666', name: 'Boutique Mado',  balance: 32500 },
  ];
  const vendors = await Promise.all(
    vendorData.map(v =>
      prisma.user.upsert({
        where: { phone: v.phone },
        update: {},
        create: {
          phone:      v.phone,
          name:       v.name,
          pinHash:    pin1234,
          roles:      JSON.stringify(['VENDOR']),
          activeRole: 'VENDOR',
          kycStatus:  'VERIFIED',
          wallet: { create: { balanceXAF: v.balance, paymentProvider: 'MTN' } },
        },
      })
    )
  );

  // ── Deliverers ──────────────────────────────────────────────────────────────
  const delivererData = [
    { phone: '+237677234567', name: 'Hervé Nkouamba', balance: 12500 },
    { phone: '+237655456789', name: 'Marc Tchioffo',  balance: 8750  },
    { phone: '+237677567890', name: 'Paul Kamga',     balance: 21000 },
  ];
  const deliverers = await Promise.all(
    delivererData.map(d =>
      prisma.user.upsert({
        where: { phone: d.phone },
        update: {},
        create: {
          phone:      d.phone,
          name:       d.name,
          pinHash:    pin1234,
          roles:      JSON.stringify(['DELIVERER']),
          activeRole: 'DELIVERER',
          kycStatus:  'VERIFIED',
          wallet: { create: { balanceXAF: d.balance, paymentProvider: 'MTN' } },
        },
      })
    )
  );

  // ── Sample deliveries ───────────────────────────────────────────────────────
  const mkDelivery = (token: string, vid: string, did: string | undefined, from: string, to: string, type: string, status: string, price: number, cc: string, dc: string) => {
    const comm = Math.round(price * 0.03);
    return prisma.delivery.upsert({
      where: { clientToken: token },
      update: {},
      create: {
        vendorId: vid, delivererId: did,
        pickupAddress: from, dropoffAddress: to,
        weightKg: 2.0, delivererType: type, status,
        collectCode: cc, deliverCode: dc, clientToken: token,
        priceXAF: price, commissionXAF: comm, delivererEarning: price - comm,
        escrow: { create: { amountXAF: price } },
      },
    });
  };

  await mkDelivery('seed-001', vendors[0].id, deliverers[0].id, 'Bonapriso, Rue des Brasseries', 'Logpom, Carrefour Shell',   'EXPRESS',     'LIVRE',      2125, '4821', '7359');
  await mkDelivery('seed-002', vendors[1].id, undefined,        'Bali, Avenue W. Churchill',    'PK14, Rond-Point Université','VVIP',        'EN_ATTENTE', 4865, '1234', '5678');
  await mkDelivery('seed-003', vendors[2].id, deliverers[1].id, 'Akwa, Place de la Poste',      'Deïdo, Marché Congo',        'TEMPORAIRE',  'EN_ROUTE',   1500, '9012', '3456');
  await mkDelivery('seed-004', vendors[0].id, deliverers[2].id, 'Bonanjo, Immeuble BICEC',      'Bonabéri, Rond-Point CICAM', 'PERMANENT',   'LIVRE',      3200, '7890', '1234');

  console.log('\n✅ Seed terminé.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑  ADMIN       +237600000001  PIN: 1234');
  console.log('📦  Vendeur 1   +237655111222  PIN: 1234');
  console.log('📦  Vendeur 2   +237677333444  PIN: 1234');
  console.log('🏍️   Livreur 1   +237677234567  PIN: 1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n👉  Back Office: http://localhost:5174');
  console.log('👉  API:         http://localhost:3000\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
