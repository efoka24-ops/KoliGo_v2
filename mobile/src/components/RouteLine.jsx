import React from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../constants/colors';

export default function RouteLine({ from, to }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
      <View style={{ width: 14, alignItems: 'center', paddingTop: 4 }}>
        <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#fff', borderWidth: 2.5, borderColor: colors.green }} />
        <View style={{ flex: 1, width: 2, backgroundColor: colors.ink12, marginTop: 2, marginBottom: 2, minHeight: 16 }} />
        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colors.orange }} />
      </View>
      <View style={{ flex: 1, gap: 6, paddingTop: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{from}</Text>
        <Text numberOfLines={1} style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{to}</Text>
      </View>
    </View>
  );
}
