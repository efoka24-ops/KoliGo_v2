// Web version — OpenStreetMap via Leaflet CDN loaded at runtime.
import React, { useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';

const DOUALA = [4.0500, 9.7000];
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
let leafletLoader = null;

// Orange moto marker HTML
const MOTO_HTML = `<div style="width:36px;height:36px;border-radius:50%;background:#F5611A;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(245,97,26,0.5)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M8.5 17h6l3-7h2M11 10h6l1.5 4M5.5 14V11h3"/></svg></div>`;

// Blue client dot HTML
const CLIENT_HTML = `<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3.5px solid #fff;box-shadow:0 2px 6px rgba(59,130,246,0.5)"></div>`;

function ensureLeaflet() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.L) {
    return Promise.resolve(window.L);
  }
  if (!leafletLoader) {
    leafletLoader = new Promise((resolve, reject) => {
      const existingCss = document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`);
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_URL;
        document.head.appendChild(link);
      }

      const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.L), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Leaflet failed to load')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = LEAFLET_JS_URL;
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Leaflet failed to load'));
      document.body.appendChild(script);
    });
  }
  return leafletLoader;
}

export default function LiveMap({ delivererPos, clientPos }) {
  const mapIdRef = useRef(`kg-leaflet-map-${Math.random().toString(36).slice(2, 10)}`);
  const mapRef = useRef(null);
  const motoMarkerRef = useRef(null);
  const clientMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  const dp = delivererPos ? [delivererPos.lat, delivererPos.lng] : null;
  const cp = clientPos   ? [clientPos.lat,   clientPos.lng]   : null;

  useEffect(() => {
    let isCancelled = false;

    ensureLeaflet()
      .then((L) => {
        const node = document.getElementById(mapIdRef.current);
        if (!L || !node || mapRef.current || isCancelled) return;

        let center = DOUALA;
        let zoom = 13;
        if (dp && cp) center = [(dp[0] + cp[0]) / 2, (dp[1] + cp[1]) / 2];
        else if (dp) {
          center = dp;
          zoom = 14;
        } else if (cp) {
          center = cp;
          zoom = 14;
        }

        const map = L.map(node, { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        map.setView(center, zoom);
        mapRef.current = map;

        const motoIcon = L.divIcon({ className: '', html: MOTO_HTML, iconSize: [36, 36], iconAnchor: [18, 18] });
        const clientIcon = L.divIcon({ className: '', html: CLIENT_HTML, iconSize: [22, 22], iconAnchor: [11, 11] });

        if (dp) motoMarkerRef.current = L.marker(dp, { icon: motoIcon }).addTo(map);
        if (cp) clientMarkerRef.current = L.marker(cp, { icon: clientIcon }).addTo(map);
        if (dp && cp) {
          polylineRef.current = L.polyline([dp, cp], { color: '#F5611A', weight: 3, dashArray: '8 5' }).addTo(map);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      motoMarkerRef.current = null;
      clientMarkerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  // Update markers when positions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (dp && motoMarkerRef.current)   motoMarkerRef.current.setLatLng(dp);
    if (cp && clientMarkerRef.current) clientMarkerRef.current.setLatLng(cp);
    if (dp && cp && polylineRef.current) polylineRef.current.setLatLngs([dp, cp]);
    if (dp && cp) map.setView([(dp[0] + cp[0]) / 2, (dp[1] + cp[1]) / 2], 13, { animate: true });
  }, [dp?.[0], dp?.[1], cp?.[0], cp?.[1]]);

  return (
    <View style={{ height: 220, borderRadius: 18, overflow: 'hidden' }}>
      <View nativeID={mapIdRef.current} style={{ width: '100%', height: '100%' }} />

      {/* GPS badge */}
      {dp ? (
        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: colors.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 1000 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: '#fff' }}>GPS Live</Text>
        </View>
      ) : (
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 1000 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange }} />
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 10, color: '#fff' }}>GPS livreur en attente…</Text>
        </View>
      )}
    </View>
  );
}


