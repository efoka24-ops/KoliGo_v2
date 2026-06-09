import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/colors';
import { KG_PRICING } from '../constants/data';

function RcptRow({ label, value, mono }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.label, { fontFamily: `${fonts.ui}-SemiBold` }]}>{label}</Text>
      <Text style={[s.value, mono && { fontFamily: `${fonts.mono}-Medium` }]}>{value}</Text>
    </View>
  );
}

function RcptLine({ label, value, bold }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontFamily: bold ? `${fonts.display}-Bold` : `${fonts.ui}-Regular`, fontSize: bold ? 15 : 13, color: colors.ink }}>{label}</Text>
      <Text style={{ fontFamily: bold ? `${fonts.display}-ExtraBold` : `${fonts.mono}-Medium`, fontSize: bold ? 16 : 13, color: colors.ink }}>
        {typeof value === 'number' ? `${value.toLocaleString('fr-FR')} XAF` : value}
      </Text>
    </View>
  );
}

function RcptLineSmall({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
      <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink55 }}>{label}</Text>
      <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 11.5, color: colors.ink55 }}>{value.toLocaleString('fr-FR')} XAF</Text>
    </View>
  );
}

function FakeQR({ seed }) {
  const cells = Array.from({ length: 49 }, (_, i) =>
    ((i * 7 + i + (seed.charCodeAt(i % seed.length) || 0)) % 3 === 0)
  );
  return (
    <View style={{ width: 56, height: 56, padding: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.ink12, borderRadius: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
      {cells.map((on, i) => (
        <View key={i} style={{ width: 5.5, height: 5.5, backgroundColor: on ? colors.ink : 'transparent', borderRadius: 0.5 }} />
      ))}
    </View>
  );
}

function Divider({ dashed }) {
  return (
    <View style={{ height: 1, borderTopWidth: 1, borderTopColor: colors.ink12, borderStyle: dashed ? 'dashed' : 'solid', marginVertical: 12 }} />
  );
}

export default function KGReceipt({ kind = 'payment', orderId, date, vendor, client, deliverer, split, codeReception, paymentRef, paymentMethod }) {
  const isPayment = kind === 'payment';
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <View>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.green, letterSpacing: -0.02 * 18 }}>
            Koli<Text style={{ color: colors.orange }}>Go</Text>
          </Text>
          <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 9, color: colors.ink55, marginTop: 2, letterSpacing: 0.06 }}>
            REÇU · {isPayment ? 'PAIEMENT' : 'LIVRAISON'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: `${fonts.mono}-Medium`, fontSize: 11, color: colors.ink55 }}>{orderId}</Text>
          <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 9, color: colors.ink35, marginTop: 2 }}>{date}</Text>
        </View>
      </View>

      <Divider dashed />

      {/* Parties */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
        <View style={{ flex: 1 }}><RcptRow label="Vendeur" value={vendor} /></View>
        <View style={{ flex: 1 }}><RcptRow label="Client" value={client} /></View>
      </View>
      {(deliverer || paymentMethod) && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {deliverer && <View style={{ flex: 1 }}><RcptRow label="Livreur" value={deliverer} /></View>}
          {paymentMethod && <View style={{ flex: 1 }}><RcptRow label="Paiement" value={paymentMethod} /></View>}
        </View>
      )}

      <Divider dashed />

      {/* Lines */}
      {isPayment ? (
        <>
          <RcptLine label="Marchandise" value={split.merchandise} />
          <RcptLine label="Livraison" value={split.delivery} />
          <RcptLine label="Frais de service" value={split.serviceFee} />
          <View style={{ height: 1, backgroundColor: colors.ink, marginVertical: 8 }} />
          <RcptLine label="TOTAL PAYÉ" value={split.total} bold />
        </>
      ) : (
        <>
          <RcptRow label="Code réception" value={codeReception} mono />
          <RcptRow label="Réf. paiement" value={paymentRef} mono />
          <RcptLine label="Frais livraison" value={split.delivery} />
          <View style={{ height: 1, backgroundColor: colors.ink, marginVertical: 8 }} />
          <RcptLine label="STATUT" value="LIVRÉ ✓" bold />
        </>
      )}

      {/* Répartition */}
      {isPayment && (
        <>
          <Divider dashed />
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 9.5, color: colors.ink55, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 6 }}>Répartition automatique</Text>
          <RcptLineSmall label={`Vendeur (net ${(100 - KG_PRICING.vendorCommission * 100).toFixed(0)} %)`} value={split.vendorNet} />
          <RcptLineSmall label={`Livreur (${(KG_PRICING.delivererShare * 100).toFixed(0)} % livraison)`} value={split.delivererNet} />
          <RcptLineSmall label="Plateforme KoliGo" value={split.platformTotal} />
        </>
      )}

      <Divider dashed />

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 8.5, color: colors.ink35, lineHeight: 13 }}>
            {'KoliGo SARL · Douala 🇨🇲\nsupport@koligo.cm · +237 6 99 00 00 00'}
          </Text>
          <Text style={{ fontFamily: `${fonts.mono}-Regular`, fontSize: 8.5, color: colors.ink35, marginTop: 2 }}>
            koligo.cm/v/{orderId?.toLowerCase()}
          </Text>
        </View>
        <FakeQR seed={orderId || 'KG'} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.ink12,
  },
  label: {
    fontSize: 9.5,
    color: colors.ink55,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    marginBottom: 2,
  },
  value: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: 13,
    color: colors.ink,
  },
});
