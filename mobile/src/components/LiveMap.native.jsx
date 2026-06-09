import React from 'react';
import { View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

// Android → Google Maps, iOS → Apple Maps (no extra SDK config needed on iOS)
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const DOUALA = { latitude: 4.0500, longitude: 9.7000 };

function getRegion(delivererPos, clientPos) {
  const dc = delivererPos ? { latitude: delivererPos.lat, longitude: delivererPos.lng } : null;
  const cc = clientPos   ? { latitude: clientPos.lat,   longitude: clientPos.lng   } : null;
  if (dc && cc) {
    const latD = Math.abs(dc.latitude  - cc.latitude)  * 2.5 + 0.015;
    const lngD = Math.abs(dc.longitude - cc.longitude) * 2.5 + 0.015;
    return { latitude: (dc.latitude + cc.latitude) / 2, longitude: (dc.longitude + cc.longitude) / 2, latitudeDelta: Math.max(latD, 0.01), longitudeDelta: Math.max(lngD, 0.01) };
  }
  if (dc) return { ...dc, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  if (cc) return { ...cc, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  return { ...DOUALA, latitudeDelta: 0.12, longitudeDelta: 0.12 };
}

export default function LiveMap({ delivererPos, clientPos }) {
  const dc = delivererPos ? { latitude: delivererPos.lat, longitude: delivererPos.lng } : null;
  const cc = clientPos   ? { latitude: clientPos.lat,   longitude: clientPos.lng   } : null;
  const region = getRegion(delivererPos, clientPos);

  return (
    <View style={{ height: 220, borderRadius: 18, overflow: 'hidden' }}>
      <MapView
        provider={MAP_PROVIDER}
        style={{ flex: 1 }}
        region={region}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        mapType="standard"
      >
        {/* Deliverer orange marker */}
        {dc && (
          <Marker coordinate={dc} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', shadowColor: colors.orange, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 }}>
                <Icon name="moto" size={20} color="#fff" />
              </View>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 2 }}>
                <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 9, color: colors.orange }}>Livreur</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Client blue dot */}
        {cc && (
          <Marker coordinate={cc} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} title="Toi">
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#3B82F6', borderWidth: 3.5, borderColor: '#fff', shadowColor: '#3B82F6', shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 }} />
          </Marker>
        )}

        {/* Dashed route between deliverer and client */}
        {dc && cc && (
          <Polyline
            coordinates={[dc, cc]}
            strokeColor={colors.orange}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
      </MapView>

      {/* GPS Live badge */}
      {dc ? (
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
    </View>
  );
}
