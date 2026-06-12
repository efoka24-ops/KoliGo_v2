import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findMany({ select: { name: true, phone: true, roles: true, activeRole: true, kycStatus: true } })
  .then(u => { console.log(JSON.stringify(u, null, 2)); p.$disconnect(); });
