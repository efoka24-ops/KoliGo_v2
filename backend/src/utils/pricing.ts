export type DelivererType = 'TEMPORAIRE' | 'PERMANENT' | 'EXPRESS' | 'VVIP' | 'INTERURBAIN' | 'FROID_FRAGILE';

const COEFFICIENTS: Record<DelivererType, number> = {
  TEMPORAIRE: 1.00,
  PERMANENT: 1.15,
  EXPRESS: 1.25,
  VVIP: 1.40,
  INTERURBAIN: 1.00,
  FROID_FRAGILE: 1.30,
};

interface Config { baseRate: number; perKmRate: number; weightSurcharge: number; commissionRate: number }

export interface PriceBreakdown {
  basePrice: number;
  multiplier: number;
  finalPrice: number;
  commissionXAF: number;
  delivererEarning: number;
}

export function calculatePrice(
  distanceKm: number,
  weightKg: number,
  delivererType: DelivererType,
  config: Config
): PriceBreakdown {
  const multiplier = COEFFICIENTS[delivererType];
  const basePrice = Math.round(
    (config.baseRate + distanceKm * config.perKmRate + weightKg * config.weightSurcharge) * multiplier
  );
  const commissionXAF = Math.round(basePrice * config.commissionRate);
  return {
    basePrice,
    multiplier,
    finalPrice: basePrice,
    commissionXAF,
    delivererEarning: basePrice - commissionXAF,
  };
}

export const DEFAULT_PRICING: Config = {
  baseRate: 500,
  perKmRate: 150,
  weightSurcharge: 100,
  commissionRate: 0.03,
};
