export const KG_QUARTIERS = [
  'Akwa', 'Bonanjo', 'Bonapriso', 'Deïdo', 'Bali',
  'Bonamoussadi', 'Makepe', 'Logbessou', 'Logpom',
  'PK14', 'Bépanda', 'New Bell', 'Bonabéri',
];

export const KG_DEMO_DELIVERIES = [
  { id: 'KG-2841', from: 'Akwa', to: 'Bonamoussadi', distance: 7.2, weight: 1.5, type: 'permanent', price: 1955, recipient: 'Aïcha N.', recipientId: 'aicha_mb', status: 'en_route', code: '4827', collectCode: '2913', time: '14:32', vendor: 'Maman Cécile', convIdDeliverer: 'c_herve', convIdClient: 'c_aicha' },
  { id: 'KG-2839', from: 'Bonanjo', to: 'Makepe', distance: 5.4, weight: 0.8, type: 'express', price: 1700, recipient: 'Jean K.', recipientId: 'jean_k', status: 'accepte', code: '7104', collectCode: '5562', time: '13:15', vendor: 'Boutique Mado', convIdDeliverer: 'c_herve', convIdClient: null },
  { id: 'KG-2810', from: 'Bali', to: 'PK14', distance: 12.1, weight: 3.0, type: 'vvip', price: 4438, recipient: 'Sandra E.', status: 'livre', code: '9321', collectCode: '4408', time: 'Hier', vendor: 'KameTrend' },
  { id: 'KG-2799', from: 'Deïdo', to: 'Logbessou', distance: 6.8, weight: 0.5, type: 'temporaire', price: 1570, recipient: 'Paul T.', status: 'livre', code: '1188', collectCode: '0073', time: 'Hier', vendor: 'Le Coin Beauté' },
  { id: 'KG-2742', from: 'Akwa', to: 'Bonabéri', distance: 9.0, weight: 2.2, type: 'permanent', price: 2415, recipient: 'Marie F.', status: 'livre', code: '5503', collectCode: '7791', time: '12 mai', vendor: 'Maman Cécile' },
];

export const KG_AVAILABLE_FOR_DELIVERER = [
  { id: 'KG-2861', from: 'Bonapriso', to: 'Logpom', distance: 8.4, weight: 1.2, type: 'express', price: 2125, vendor: 'KameTrend', vendorRating: 4.8, posted: 'il y a 2 min' },
  { id: 'KG-2860', from: 'Akwa', to: 'Bonamoussadi', distance: 7.0, weight: 0.6, type: 'temporaire', price: 1610, vendor: 'Maman Cécile', vendorRating: 4.9, posted: 'il y a 5 min' },
  { id: 'KG-2858', from: 'Bali', to: 'PK14', distance: 12.5, weight: 2.5, type: 'vvip', price: 4865, vendor: 'Boutique Mado', vendorRating: 4.7, posted: 'il y a 8 min' },
  { id: 'KG-2855', from: 'Deïdo', to: 'Makepe', distance: 5.8, weight: 0.4, type: 'permanent', price: 1771, vendor: 'Le Coin Beauté', vendorRating: 4.6, posted: 'il y a 14 min' },
  { id: 'KG-2851', from: 'New Bell', to: 'Bonabéri', distance: 10.3, weight: 1.8, type: 'permanent', price: 2300, vendor: 'Tantine Audrey', vendorRating: 4.5, posted: 'il y a 22 min' },
];

export const KG_WALLET_TX = [
  { id: 1, type: 'gain', label: 'Livraison KG-2841', amount: 1955, date: "Aujourd'hui 14:32", icon: 'package' },
  { id: 2, type: 'gain', label: 'Livraison KG-2839', amount: 1700, date: "Aujourd'hui 11:08", icon: 'package' },
  { id: 3, type: 'withdraw', label: 'Retrait MTN MoMo', amount: -10000, date: 'Hier 18:42', icon: 'arrow' },
  { id: 4, type: 'gain', label: 'Livraison KG-2810', amount: 4438, date: 'Hier 16:20', icon: 'package' },
  { id: 5, type: 'bonus', label: 'Bonus 10 livraisons', amount: 2000, date: 'Hier 09:00', icon: 'sparkle' },
  { id: 6, type: 'gain', label: 'Livraison KG-2799', amount: 1570, date: 'Hier 08:14', icon: 'package' },
];

// Ancienne formule MVP (utilisée par les anciens écrans)
export function kgComputePrice({ distance, weight, type }) {
  const base = 500 + distance * 150 + weight * 100;
  const mult = { temporaire: 1, permanent: 1.15, vvip: 1.4, express: 1.25 }[type] || 1;
  return Math.round(base * mult);
}

// ─── Moteur de prix v2 (calibré Douala) ──────────────────────────────────────
export const KG_PRICING = {
  base: 500,
  perKm: 150,
  minDistanceKm: 2,
  minPrice: 1000,
  weightTiers: [[5, 0], [15, 300], [30, 700], [Infinity, 1500]],
  zoneBonus: { intra: 0, inter: 200, arrondissement: 500, wouri: 300 },
  hourMultiplier: { day: 1, evening: 1.15, night: 1.30, sunday: 1.10 },
  urgency: { standard: 0, express: 800 },
  vendorCommission: 0.03,
  delivererShare: 0.80,
  serviceFee: 100,
};

export function kgComputeDeliveryPrice({ distanceKm, weightKg, zone = 'inter', hour = 'day', urgency = 'standard' }) {
  const dist = Math.max(distanceKm, KG_PRICING.minDistanceKm);
  const weightSurcharge = KG_PRICING.weightTiers.find(([max]) => weightKg <= max)[1];
  let p = KG_PRICING.base
    + dist * KG_PRICING.perKm
    + weightSurcharge
    + KG_PRICING.zoneBonus[zone]
    + KG_PRICING.urgency[urgency];
  p = p * KG_PRICING.hourMultiplier[hour];
  return Math.max(KG_PRICING.minPrice, Math.round(p / 50) * 50);
}

export function kgSplitPayment({ merchandise, delivery }) {
  const vendorCom = Math.round(merchandise * KG_PRICING.vendorCommission);
  const vendorNet = merchandise - vendorCom;
  const delivererNet = Math.round(delivery * KG_PRICING.delivererShare);
  const platformLiv = delivery - delivererNet;
  const total = merchandise + delivery + KG_PRICING.serviceFee;
  const platformTotal = vendorCom + platformLiv + KG_PRICING.serviceFee;
  return { total, vendorNet, vendorCom, delivererNet, platformLiv, platformTotal, serviceFee: KG_PRICING.serviceFee, merchandise, delivery };
}

export function formatPrice(amount) {
  return amount.toLocaleString('fr-FR');
}

// ─── Distance estimée entre quartiers de Douala ───────────────────────────────

export const KG_QUARTIER_COORDS = {
  'Akwa':         { lat: 4.054, lng: 9.700 },
  'Bonanjo':      { lat: 4.042, lng: 9.693 },
  'Bonapriso':    { lat: 4.038, lng: 9.714 },
  'Deïdo':        { lat: 4.065, lng: 9.711 },
  'Bali':         { lat: 4.050, lng: 9.718 },
  'Bonamoussadi': { lat: 4.075, lng: 9.757 },
  'Makepe':       { lat: 4.065, lng: 9.745 },
  'Logbessou':    { lat: 4.085, lng: 9.770 },
  'Logpom':       { lat: 4.060, lng: 9.775 },
  'PK14':         { lat: 4.095, lng: 9.810 },
  'Bépanda':      { lat: 4.060, lng: 9.730 },
  'New Bell':     { lat: 4.055, lng: 9.720 },
  'Bonabéri':     { lat: 4.060, lng: 9.645 },
};

function haversineKm(a, b) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Retourne la distance routière estimée en km (facteur 1.35 pour Douala)
export function kgEstimateDistance(from, to) {
  if (from === to) return 0.5;
  const c1 = KG_QUARTIER_COORDS[from];
  const c2 = KG_QUARTIER_COORDS[to];
  if (!c1 || !c2) return 5.0;
  const raw = haversineKm(c1, c2);
  return Math.round(raw * 1.35 * 10) / 10;
}
