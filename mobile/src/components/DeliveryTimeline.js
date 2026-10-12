import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';
import { tr } from '../i18n/tr';

// Étapes enregistrées par le serveur pour chaque livraison (table DeliveryEvent).
const LABELS = {
  CREATED: 'Course publiée',
  ACCEPTED: 'Livreur trouvé',
  REVISION_PROPOSED: 'Correction du gabarit proposée',
  REVISION_ACCEPTED: 'Correction acceptée',
  REVISION_REFUSED: 'Correction refusée',
  COLLECTED: 'Colis collecté',
  DELIVERED: 'Colis livré',
  CANCELLED: 'Course annulée',
  REJECTED: 'Colis refusé par le livreur',
  VALUE_FLAGGED: 'Valeur déclarée signalée',
};

function when(iso) {
  const t = new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z'));
  if (Number.isNaN(t.getTime())) return '';
  return `${t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function DeliveryTimeline({ events }) {
  if (!Array.isArray(events) || events.length === 0) return null;
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCC8', padding: 14 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 10 }}>
        {tr('Historique de la course')}
      </Text>
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const bad = e.type === 'CANCELLED' || e.type === 'REVISION_REFUSED';
        return (
          <View key={`${e.type}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 3, backgroundColor: last ? (bad ? '#C4611A' : colors.green) : '#fff', borderWidth: 2, borderColor: bad ? '#C4611A' : colors.green }} />
              {!last && <View style={{ flex: 1, width: 2, backgroundColor: '#E8DCC8', marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{tr(LABELS[e.type] || e.type)}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55, marginTop: 1 }}>{when(e.createdAt)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Ce que le vendeur a déclaré et que le livreur doit vérifier à la collecte. */
export function ParcelFlags({ declaredValue, fragile, note }) {
  if (!declaredValue && !fragile && !note) return null;
  return (
    <View style={{ backgroundColor: '#FFF8E3', borderRadius: 16, borderWidth: 1, borderColor: '#EBD9A8', padding: 14, gap: 6 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: '#8A6410', textTransform: 'uppercase', letterSpacing: 0.06 }}>{tr('À vérifier à la collecte')}</Text>
      {fragile ? <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13.5, color: colors.ink }}>{tr('Colis fragile')}</Text> : null}
      {declaredValue ? <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink }}>{`${tr('Valeur déclarée')} : ${Number(declaredValue).toLocaleString('fr-FR')} XAF`}</Text> : null}
      {note ? <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13.5, color: colors.ink }}>{note}</Text> : null}
    </View>
  );
}
