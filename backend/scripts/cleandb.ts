import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Nettoyage de la base de données...');

  const counts = {
    gpsLocations:   await prisma.gpsLocation.count(),
    escrowEntries:  await prisma.escrowEntry.count(),
    ratings:        await prisma.rating.count(),
    issues:         await prisma.issue.count(),
    transactions:   await prisma.transaction.count(),
    withdrawals:    await prisma.withdrawal.count(),
    deliveries:     await prisma.delivery.count(),
    otpCodes:       await prisma.otpCode.count(),
  };
  console.log('Données à supprimer :', counts);

  await prisma.$transaction([
    prisma.gpsLocation.deleteMany(),
    prisma.escrowEntry.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.issue.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.otpCode.deleteMany(),
  ]);

  // Reset wallet balances to 0 (keep wallets, just zero balance)
  await prisma.wallet.updateMany({ data: { balanceXAF: 0 } });

  const remaining = {
    users:         await prisma.user.count(),
    wallets:       await prisma.wallet.count(),
    cities:        await prisma.city.count(),
    neighborhoods: await prisma.neighborhood.count(),
  };
  console.log('✅ Nettoyage terminé. Données conservées :', remaining);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
