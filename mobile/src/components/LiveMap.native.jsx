import React, { useState } from 'react';
import { View, Text, Image, Linking, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

// Carte OpenStreetMap en JavaScript pur : aucune cle, aucun SDK natif (l'ancienne
// carte Google exigeait une cle autorisee pour l'appli). On dessine les tuiles
// https://tile.openstreetmap.org/{z}/{x}/{y}.png, les marqueurs et le trajet.
// Carte fixe (pas de zoom ni de deplacement) : elle se recadre seule sur les points.

// Les serveurs OSM refusent (403) le User-Agent par defaut d'Android : leur politique d'usage
// exige un identifiant propre a l'application. L'URL est configurable pour passer a un
// fournisseur de tuiles dedie (volume eleve) : EXPO_PUBLIC_TILE_URL=https://.../{z}/{x}/{y}.png
const TILE_URL = process.env.EXPO_PUBLIC_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_HEADERS = { 'User-Agent': 'KoliGo/1.0 (livraison collaborative Cameroun; http://koligo.trugroup.cm/)', Referer: 'http://koligo.trugroup.cm/' };

const TILE = 256;
const HEIGHT = 240;
const DOUALA = { lat: 4.05, lng: 9.7 };
const MIN_Z = 3;
const MAX_Z = 17;

const worldPx = (lat, lng, z) => {
  const scale = TILE * 2 ** z;
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * scale,
  };
};

// Plus grand zoom pour lequel tous les points tiennent dans la vue (avec marge).
function pickZoom(points, w, h) {
  if (points.length < 2) return points.length === 1 ? 15 : 12;
  for (let z = MAX_Z; z >= MIN_Z; z--) {
    const px = points.map(p => worldPx(p.lat, p.lng, z));
    const xs = px.map(p => p.x);
    const ys = px.map(p => p.y);
    if (Math.max(...xs) - Math.min(...xs) <= w * 0.7 && Math.max(...ys) - Math.min(...ys) <= h * 0.6) return z;
  }
  return MIN_Z;
}

export default function LiveMap({ delivererPos, clientPos }) {
  const [w, setW] = useState(320);
  const pts = [delivererPos, clientPos].filter(Boolean);

  const center = pts.length
    ? { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length }
    : DOUALA;
  const z = pickZoom(pts, w, HEIGHT);
  const c = worldPx(center.lat, center.lng, z);
  const originX = c.x - w / 2; // coin haut-gauche de la vue, en pixels "monde"
  const originY = c.y - HEIGHT / 2;

  const n = 2 ** z;
  const tiles = [];
  for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + w) / TILE); tx++) {
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + HEIGHT) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n; // longitude cyclique
      tiles.push({ key: `${z}/${tx}/${ty}`, uri: TILE_URL.replace('{z}', z).replace('{x}', wx).replace('{y}', ty), left: tx * TILE - originX, top: ty * TILE - originY });
    }
  }

  const at = (p) => {
    const q = worldPx(p.lat, p.lng, z);
    return { x: q.x - originX, y: q.y - originY };
  };
  const d = delivererPos ? at(delivererPos) : null;
  const k = clientPos ? at(clientPos) : null;

  // Trait pointille entre le livreur et le destinataire : une vue tournee.
  let line = null;
  if (d && k) {
    const dx = k.x - d.x;
    const dy = k.y - d.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    line = { len, angle: Math.atan2(dy, dx), mx: (d.x + k.x) / 2, my: (d.y + k.y) / 2 };
  }

  return (
    <View
      style={{ height: HEIGHT, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E8E4DA' }}
      onLayout={(e) => setW(Math.max(100, Math.round(e.nativeEvent.layout.width)))}
    >
      {tiles.map(t => (
        <Image key={t.key} source={{ uri: t.uri, headers: TILE_HEADERS }} style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }} />
      ))}

      {line && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: line.mx - line.len / 2, top: line.my - 1.5, width: line.len, height: 0,
            borderTopWidth: 3, borderColor: colors.orange, borderStyle: 'dashed',
            transform: [{ rotate: `${line.angle}rad` }],
          }}
        />
      )}

      {k && (
        <View pointerEvents="none" style={{ position: 'absolute', left: k.x - 11, top: k.y - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#3B82F6', borderWidth: 3.5, borderColor: '#fff', elevation: 4 }} />
      )}

      {d && (
        <View pointerEvents="none" style={{ position: 'absolute', left: d.x - 20, top: d.y - 44, alignItems: 'center', width: 40 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', elevation: 6 }}>
            <Icon name="moto" size={20} color="#fff" />
          </View>
          <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.orange }} />
        </View>
      )}

      {/* Badge GPS */}
      {d ? (
        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: colors.green, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#fff' }}>GPS Live</Text>
        </View>
      ) : (
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.orange }} />
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: '#fff' }}>GPS livreur en attente…</Text>
        </View>
      )}

      {/* Attribution obligatoire (licence ODbL) */}
      <TouchableOpacity
        onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {})}
        style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 6, paddingVertical: 2 }}
      >
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: '#333' }}>© OpenStreetMap contributors</Text>
      </TouchableOpacity>
    </View>
  );
}
