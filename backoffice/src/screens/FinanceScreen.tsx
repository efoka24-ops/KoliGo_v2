import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FinanceScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Finance</Text>
      <View style={s.placeholder}>
        <Text style={s.soon}>Retraits · Commissions · Ledger</Text>
        <Text style={s.sub}>TODO: wire to /admin/stats + transactions</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F1' },
  title: { fontSize: 22, fontWeight: '800', color: '#15140F', padding: 18 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  soon: { fontSize: 16, fontWeight: '700', color: '#178A3C' },
  sub: { fontSize: 12, color: '#76746B' },
});
