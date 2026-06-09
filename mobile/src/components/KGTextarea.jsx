import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors, fonts } from '../constants/colors';

export default function KGTextarea({ label, value, onChangeText, placeholder, rows = 3 }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>{label}</Text>
      )}
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink35}
        multiline
        numberOfLines={rows}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: 1, borderColor: focused ? colors.green : colors.ink12,
          borderRadius: 12, padding: 14,
          fontFamily: `${fonts.ui}-Regular`, fontSize: 15, color: colors.ink,
          backgroundColor: '#fff', textAlignVertical: 'top',
          minHeight: rows * 24 + 28,
        }}
      />
    </View>
  );
}
