import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

export default function KGTopBar({ title, onBack, action, dark, transparent }) {
  const insets = useSafeAreaInsets();
  const textColor = dark ? '#fff' : colors.ink;
  const bg = transparent || dark ? 'transparent' : '#fff';
  const btnBg = dark ? 'rgba(255,255,255,0.12)' : colors.ink06;
  const actionNode = action || <View style={{ width: 40, height: 40 }} />;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 8, minHeight: 52,
      backgroundColor: bg,
      borderBottomWidth: transparent || dark ? 0 : 1,
      borderBottomColor: colors.ink06,
    }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ width: 40, height: 40, backgroundColor: btnBg, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="back" size={20} color={textColor} />
      </TouchableOpacity>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: textColor, letterSpacing: -0.01, marginHorizontal: 12 }}>
        {title}
      </Text>
      <View style={{ minWidth: 40, minHeight: 40, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
        {actionNode}
      </View>
    </View>
  );
}
