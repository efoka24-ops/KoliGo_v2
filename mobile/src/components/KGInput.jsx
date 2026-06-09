import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

export default function KGInput({ label, value, onChangeText, placeholder, secureTextEntry, icon, suffix, hint, error, keyboardType }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry || false);

  return (
    <View style={{ gap: 6, outlineWidth: 0, outlineStyle: 'none' }}>
      {label && (
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink70 }}>{label}</Text>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        height: 52, paddingHorizontal: 14, borderRadius: 12,
        borderWidth: 1, borderColor: error ? '#D8472A' : (focused ? colors.green : colors.ink12),
        backgroundColor: '#fff',
      }}>
        {icon && <Icon name={icon} size={18} color={colors.ink55} />}
        <TextInput
          value={value || ''}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink35}
          secureTextEntry={hidden}
          keyboardType={keyboardType || 'default'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, fontFamily: `${fonts.ui}-Regular`, fontSize: 15, color: colors.ink, outlineWidth: 0, outlineStyle: 'none', boxShadow: 'none' }}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(h => !h)}>
            <Icon name="eye" size={18} color={colors.ink55} />
          </TouchableOpacity>
        )}
        {suffix && !secureTextEntry && (
          <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55 }}>{suffix}</Text>
        )}
      </View>
      {hint && (
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: error ? '#D8472A' : colors.ink55 }}>{hint}</Text>
      )}
    </View>
  );
}
