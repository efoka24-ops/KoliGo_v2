import { prisma } from '../models/prisma';
import type { Prisma } from '@prisma/client';
import { calculatePrice, DEFAULT_PRICING, DelivererType } from '../utils/pricing';
import { generate4DigitCode } from '../utils/codes';
import { signClientToken } from '../utils/jwt';

export const deliveryService = {
  async create(vendorId: string, payload: {
    pickupAddress: string;
    dropoffAddress: string;
    weightKg: number;
    description?: string;
    delivererType?: string;
    distanceKm?: number;
  }) {
    const type = (payload.delivererType ?? 'TEMPORAIRE') as DelivererType;
    const distanceKm = payload.distanceKm ?? 2.0;
    const price = calculatePrice(distanceKm, payload.weightKg, type, DEFAULT_PRICING);

    const collectCode = generate4DigitCode();
    const deliverCode = generate4DigitCode();

    const delivery = await prisma.delivery.create({
      data: {
        vendorId,
        pickupAddress: payload.pickupAddress,
        dropoffAddress: payload.dropoffAddress,
        weightKg: payload.weightKg,
        description: payload.description,
        delivererType: type as any,
        collectCode,
        deliverCode,
        clientToken: signClientToken('temp'), // replaced below
        priceXAF: price.finalPrice,
        commissionXAF: price.commissionXAF,
        delivererEarning: price.delivererEarning,
        escrow: { create: { amountXAF: price.finalPrice } },
      },
    });

    // Update clientToken with real deliveryId
    const clientToken = signClientToken(delivery.id);
    return prisma.delivery.update({
      where: { id: delivery.id },
      data: { clientToken },
    });
  },

  async accept(deliveryId: string, delivererId: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.status !== 'EN_ATTENTE') throw new Error('Delivery not available');
    return prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'ACCEPTE', delivererId },
    });
  },

  async cancel(deliveryId: string, vendorId: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.vendorId !== vendorId) throw new Error('Forbidden');
    if (!['EN_ATTENTE', 'ACCEPTE'].includes(d.status)) throw new Error('Cannot cancel in current state');
    await prisma.escrowEntry.update({ where: { deliveryId }, data: { releasedAt: new Date() } });
    return prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'ANNULE' } });
  },

  async confirmCollect(deliveryId: string, delivererId: string, collectCode: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.delivererId !== delivererId) throw new Error('Forbidden');
    if (d.status !== 'ACCEPTE') throw new Error('Wrong state');
    if (d.collectCode !== collectCode) throw new Error('Wrong collect code');
    return prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'EN_ROUTE' } });
  },

  async confirmDeliver(deliveryId: string, delivererId: string, deliverCode: string, momoRef?: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { escrow: true } });
    if (d.delivererId !== delivererId) throw new Error('Forbidden');
    if (d.status !== 'EN_ROUTE') throw new Error('Wrong state');
    if (d.deliverCode !== deliverCode) throw new Error('Wrong delivery code');

    // Release escrow + credit wallets
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.escrowEntry.update({ where: { deliveryId }, data: { releasedAt: new Date() } });

      // Credit deliverer
      await tx.wallet.upsert({
        where: { userId: delivererId },
        update: { balanceXAF: { increment: d.delivererEarning } },
        create: { userId: delivererId, balanceXAF: d.delivererEarning },
      });
      await tx.transaction.create({
        data: { walletId: (await tx.wallet.findUniqueOrThrow({ where: { userId: delivererId } })).id, type: 'EARNING', amountXAF: d.delivererEarning, deliveryId },
      });

      await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'LIVRE', momoRef },
      });
    });

    return prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  },
};
