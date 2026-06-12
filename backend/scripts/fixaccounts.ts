import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Fix Foka Emmanuel: add DELIVERER role + VERIFIED KYC
  await p.user.updateMany({
    where: { phone: '691227149' },
    data: { roles: '["VENDOR","DELIVERER"]', kycStatus: 'VERIFIED' },
  });

  // Fix Efoka Stephane: VENDOR, VERIFIED KYC (so he can also be a deliverer if needed)
  await p.user.updateMany({
    where: { phone: '678758976' },
    data: { kycStatus: 'VERIFIED' },
  });

  // Fix Ibrahim Garoua, Mama Fatima — ensure DELIVERER role + VERIFIED
  await p.user.updateMany({
    where: { phone: { in: ['677001001', '677002002'] } },
    data: { roles: '["VENDOR","DELIVERER"]', kycStatus: 'VERIFIED' },
  });

  // All remaining users NONE → VERIFIED (clean test environment)
  await p.user.updateMany({
    where: { kycStatus: 'NONE' },
    data:  { kycStatus: 'VERIFIED' },
  });

  const users = await p.user.findMany({
    select: { name: true, phone: true, roles: true, activeRole: true, kycStatus: true },
  });
  console.log('✅ Comptes mis à jour :');
  users.forEach(u => console.log(` • ${u.name} (${u.phone}) — ${u.roles} — KYC: ${u.kycStatus}`));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
