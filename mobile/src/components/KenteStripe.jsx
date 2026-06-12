import React from 'react';
import { View } from 'react-native';

const KENTE = ['#0D7A3E', '#D4991A', '#C4611A', '#0E2116', '#D4991A', '#0D7A3E', '#C4611A'];

export default function KenteStripe({ height = 4 }) {
  return (
    <View style={{ flexDirection: 'row', height }}>
      {KENTE.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}
