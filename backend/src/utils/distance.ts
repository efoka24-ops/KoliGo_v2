import https from 'https';
import http from 'http';

// Road distances (km) between major Cameroon cities — bidirectional, verified
const CITY_PAIRS: Record<string, number> = {
  'douala-yaounde':     250, 'douala-bafoussam':  195, 'douala-garoua':     905,
  'douala-maroua':     1055, 'douala-ngaoundere': 620, 'douala-bamenda':    290,
  'douala-ebolowa':     215, 'douala-buea':        75, 'douala-kribi':      150,
  'douala-bertoua':     570, 'douala-edea':         55, 'douala-nkongsamba': 105,
  'douala-limbe':        65, 'douala-kumba':       105,
  'yaounde-bafoussam':  270, 'yaounde-garoua':    660, 'yaounde-maroua':   810,
  'yaounde-ngaoundere': 340, 'yaounde-bamenda':   360, 'yaounde-ebolowa':  165,
  'yaounde-kribi':      210, 'yaounde-bertoua':   350, 'yaounde-edea':     200,
  'bafoussam-bamenda':  100, 'bafoussam-ngaoundere':480,'bafoussam-garoua': 700,
  'garoua-maroua':      200, 'garoua-ngaoundere':  260,
  'ngaoundere-maroua':  310, 'ngaoundere-bertoua': 300,
  'bamenda-buea':       280, 'ebolowa-kribi':      105,
  'edea-kribi':          95, 'nkongsamba-bafoussam': 90,
};

// Coordinates for major Cameroon cities
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  douala:      { lat: 4.049, lng: 9.767 },  yaounde:    { lat: 3.866, lng: 11.516 },
  garoua:      { lat: 9.301, lng: 13.397 }, maroua:     { lat: 10.591, lng: 14.316 },
  ngaoundere:  { lat: 7.321, lng: 13.583 }, bafoussam:  { lat: 5.477, lng: 10.417 },
  bamenda:     { lat: 5.963, lng: 10.160 }, ebolowa:    { lat: 2.901, lng: 11.155 },
  buea:        { lat: 4.157, lng: 9.237 },  kribi:      { lat: 2.940, lng: 9.909 },
  bertoua:     { lat: 4.578, lng: 13.685 }, edea:       { lat: 3.803, lng: 10.131 },
  nkongsamba:  { lat: 4.952, lng: 9.942 },  limbe:      { lat: 4.022, lng: 9.199 },
  kumba:       { lat: 4.636, lng: 9.447 },  foumban:    { lat: 5.727, lng: 10.907 },
  dschang:     { lat: 5.447, lng: 10.053 }, sangmelima: { lat: 2.940, lng: 11.981 },
  mbalmayo:    { lat: 3.516, lng: 11.503 }, obala:      { lat: 4.167, lng: 11.533 },
};

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lookupPrecomputed(from: string, to: string): number | null {
  const f = norm(from), t = norm(to);
  if (f === t) return 1.0;
  return CITY_PAIRS[`${f}-${t}`] ?? CITY_PAIRS[`${t}-${f}`] ?? null;
}

function geocodeNominatim(place: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(place);
  const opts = {
    hostname: 'nominatim.openstreetmap.org',
    path: `/search?q=${q}&format=json&limit=1&countrycodes=cm`,
    headers: { 'User-Agent': 'KoliGoApp/1.0 (ngaleusteph@gmail.com)' },
  };
  return new Promise((resolve) => {
    https.get(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j?.[0]) resolve({ lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) });
          else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function osrmRoute(lat1: number, lng1: number, lat2: number, lng2: number): Promise<number | null> {
  const path = `/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  return new Promise((resolve) => {
    http.get({ hostname: 'router.project-osrm.org', path }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const m = j?.routes?.[0]?.distance;
          resolve(typeof m === 'number' ? Math.round(m / 100) / 10 : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Compute road distance between two Cameroon addresses.
 * Priority: precomputed table → known city coords → Nominatim + OSRM → Haversine×1.4 → null
 */
export async function computeDistanceKm(from: string, to: string): Promise<number | null> {
  const f = norm(from), t = norm(to);
  if (f === t) return 1.0;

  // 1. Exact precomputed city pair
  const pre = lookupPrecomputed(from, to);
  if (pre !== null) return pre;

  // 2. Both cities in known coords → Haversine × 1.4 road factor
  const c1 = CITY_COORDS[f], c2 = CITY_COORDS[t];
  if (c1 && c2) return Math.round(haversineKm(c1.lat, c1.lng, c2.lat, c2.lng) * 1.4 * 10) / 10;

  // 3. Nominatim geocoding + OSRM routing (handles specific neighborhoods)
  try {
    const [g1, g2] = await Promise.all([
      geocodeNominatim(`${from}, Cameroun`),
      geocodeNominatim(`${to}, Cameroun`),
    ]);
    if (g1 && g2) {
      const road = await osrmRoute(g1.lat, g1.lng, g2.lat, g2.lng);
      if (road !== null) return road;
      // Haversine fallback with road factor
      return Math.round(haversineKm(g1.lat, g1.lng, g2.lat, g2.lng) * 1.4 * 10) / 10;
    }
  } catch { /* fall through */ }

  return null;
}
