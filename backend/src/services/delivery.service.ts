import { prisma } from '../models/prisma';
import type { Prisma } from '@prisma/client';
import { calculatePrice, DEFAULT_PRICING, DelivererType } from '../utils/pricing';
import { generate4DigitCode } from '../utils/codes';
import { signClientToken } from '../utils/jwt';
import { emailService } from './email.service';
import { infobipService } from './infobip.service';
import https from 'https';
import { computeDistanceKm } from '../utils/distance';

async function fetchGoogleMapsDistance(origin: string, destination: string): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    origins: `${origin}, Cameroon`,
    destinations: `${destination}, Cameroon`,
    key,
    units: 'metric',
    mode: 'driving',
  });
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meters = json?.rows?.[0]?.elements?.[0]?.distance?.value;
          resolve(typeof meters === 'number' ? Math.round(meters / 100) / 10 : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

export const deliveryService = {
  async create(vendorId: string, payload: {
    pickupAddress: string;
    dropoffAddress: string;
    weightKg: number;
    description?: string;
    delivererType?: string;
    distanceKm?: number;
    shopName?: string;
    recipientName?: string;
    recipientPhone?: string;
    productPriceXAF?: number;
  }) {
    const type = (payload.delivererType ?? 'TEMPORAIRE') as DelivererType;
    const mapsKm = await fetchGoogleMapsDistance(payload.pickupAddress, payload.dropoffAddress).catch(() => null);
    const fallbackKm = mapsKm ?? await computeDistanceKm(payload.pickupAddress, payload.dropoffAddress).catch(() => null);
    const distanceKm = fallbackKm ?? payload.distanceKm ?? 2.0;
    const price = calculatePrice(distanceKm, payload.weightKg, type, DEFAULT_PRICING);

    const collectCode = generate4DigitCode();
    const deliverCode = generate4DigitCode();

    const delivery = await prisma.delivery.create({
      data: {
        vendorId,
        pickupAddress:   payload.pickupAddress,
        dropoffAddress:  payload.dropoffAddress,
        weightKg:        payload.weightKg,
        distanceKm,
        description:     payload.description,
        delivererType:   type as any,
        collectCode,
        deliverCode,
        clientToken:     signClientToken('temp'),
        priceXAF:        price.finalPrice,
        commissionXAF:   price.commissionXAF,
        delivererEarning: price.delivererEarning,
        shopName:        payload.shopName,
        recipientName:   payload.recipientName,
        recipientPhone:  payload.recipientPhone,
        productPriceXAF: payload.productPriceXAF ?? 0,
        escrow: { create: { amountXAF: price.finalPrice } },
      },
    });

    const clientToken = signClientToken(delivery.id);
    const final = await prisma.delivery.update({ where: { id: delivery.id }, data: { clientToken } });

    const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
    if (vendor) {
      if (vendor.email) {
        emailService.sendDeliveryCreated(vendor.email, vendor.name, {
          id: final.id, pickupAddress: final.pickupAddress, dropoffAddress: final.dropoffAddress,
          priceXAF: final.priceXAF, collectCode: final.collectCode,
        }).catch(() => {});
      }
      infobipService.sendDeliveryNotif(
        vendor.phone,
        `✅ KoliGo — Livraison publiée !\n${final.pickupAddress} → ${final.dropoffAddress}\nPrix : ${final.priceXAF.toLocaleString('fr-FR')} XAF\nCode collecte (pour livreur) : *${final.collectCode}*`
      ).catch(() => {});

      // Notify recipient if phone available
      if (final.recipientPhone) {
        infobipService.sendDeliveryNotif(
          final.recipientPhone,
          `📦 KoliGo — Un colis arrive pour vous !\nDe : ${final.shopName ?? final.pickupAddress}\nVotre code de réception : *${final.deliverCode}*\nGardez ce code pour confirmer la livraison et payer.`
        ).catch(() => {});
      }
    }
    return final;
  },

  async accept(deliveryId: string, delivererId: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { vendor: true } });
    if (d.status !== 'EN_ATTENTE') throw new Error('Delivery not available');
    const updated = await prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'ACCEPTE', delivererId } });

    const deliverer = await prisma.user.findUnique({ where: { id: delivererId } });
    if (d.vendor) {
      if (d.vendor.email) {
        emailService.sendDeliveryAccepted(d.vendor.email, d.vendor.name, deliverer?.name ?? 'Un livreur', {
          pickupAddress: d.pickupAddress, dropoffAddress: d.dropoffAddress,
        }).catch(() => {});
      }
      const whatsappMsg = `🛵 KoliGo — ${deliverer?.name ?? 'Un livreur'} a accepté votre livraison !\n${d.pickupAddress} → ${d.dropoffAddress}\nIl est en route vers vous.\n\nFacture de confiance disponible dans l'application.`;
      infobipService.sendDeliveryNotif(d.vendor.phone, whatsappMsg).catch(() => {});
    }

    // Notify recipient that deliverer is on the way
    if (d.recipientPhone) {
      infobipService.sendDeliveryNotif(
        d.recipientPhone,
        `🛵 KoliGo — ${deliverer?.name ?? 'Un livreur'} prend en charge votre colis !\nIl sera bientôt chez vous. Préparez votre code de réception.`
      ).catch(() => {});
    }

    return updated;
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
    await this._releaseAndCredit(d, momoRef);
    return prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  },

  // Called after recipient's MoMo payment succeeds
  async confirmDeliverByPayment(deliveryId: string, momoRef: string) {
    const d = await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { escrow: true } });
    if (d.status === 'LIVRE') return; // idempotent
    if (d.status !== 'EN_ROUTE') throw new Error('Wrong state for payment confirmation');
    await this._releaseAndCredit(d, momoRef);
  },

  async _releaseAndCredit(d: any, momoRef?: string) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.escrowEntry.update({ where: { deliveryId: d.id }, data: { releasedAt: new Date() } });

      await tx.wallet.upsert({
        where:  { userId: d.delivererId },
        update: { balanceXAF: { increment: d.delivererEarning } },
        create: { userId: d.delivererId, balanceXAF: d.delivererEarning },
      });

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: d.delivererId } });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: 'EARNING', amountXAF: d.delivererEarning, deliveryId: d.id },
      });

      await tx.delivery.update({ where: { id: d.id }, data: { status: 'LIVRE', momoRef } });
    });

    const [deliverer, vendor] = await Promise.all([
      prisma.user.findUnique({ where: { id: d.delivererId } }),
      prisma.user.findUnique({ where: { id: d.vendorId } }),
    ]);

    if (deliverer) {
      if (deliverer.email) {
        emailService.sendDeliveryCompleted(deliverer.email, deliverer.name, d.delivererEarning, { dropoffAddress: d.dropoffAddress }).catch(() => {});
      }
      infobipService.sendDeliveryNotif(
        deliverer.phone,
        `✅ KoliGo — Course payée !\nGains crédités : *${d.delivererEarning.toLocaleString('fr-FR')} XAF*\nDestination : ${d.dropoffAddress}\nRéf. : ${d.id.slice(-8).toUpperCase()}`
      ).catch(() => {});
    }

    if (vendor) {
      if (vendor.email) {
        emailService.sendDeliveryCompleted(vendor.email, vendor.name, d.delivererEarning, { dropoffAddress: d.dropoffAddress }).catch(() => {});
      }
      infobipService.sendDeliveryNotif(
        vendor.phone,
        `✅ KoliGo — Colis livré avec succès !\nDestinataire à : ${d.dropoffAddress}\nMontant transport : ${d.priceXAF.toLocaleString('fr-FR')} XAF\nRéf. : ${d.id.slice(-8).toUpperCase()}`
      ).catch(() => {});
    }
  },
};
