import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../constants/colors';

export default function KGSectionTitle({ children, action }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 18, color: colors.ink, letterSpacing: -0.02 }}>
        {children}
      </Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.green }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
