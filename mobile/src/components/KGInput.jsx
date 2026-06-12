import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

export default function KGInput({
  label, value, onChangeText, placeholder, secureTextEntry,
  icon, suffix, hint, error, keyboardType, autoCapitalize,
  autoFocus, autoComplete, textContentType, maxLength, editable,
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry || false);

  return (
    <View style={{ gap: 5 }}>
      {label && (
        <Text style={{
          fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11,
          color: error ? '#C4611A' : colors.ink55,
          textTransform: 'uppercase', letterSpacing: 0.05,
        }}>
          {label}
        </Text>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        minHeight: 52, paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: error ? '#FEF0E3' : (focused ? '#EFF8F1' : '#F5F0E8'),
        borderBottomWidth: 2,
        borderBottomColor: error ? '#C4611A' : (focused ? colors.green : 'transparent'),
      }}>
        {icon && <Icon name={icon} size={18} color={focused ? colors.green : colors.ink35} />}
        <TextInput
          value={value || ''}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink35}
          secureTextEntry={hidden}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          editable={editable !== false}
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontFamily: `${fonts.ui}-Regular`,
            fontSize: 15,
            color: colors.ink,
            paddingVertical: 14,
            outlineWidth: 0,
            outlineStyle: 'none',
          }}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(h => !h)} hitSlop={8}>
            <Icon name={hidden ? 'eye' : 'eye'} size={18} color={colors.ink35} />
          </TouchableOpacity>
        )}
        {suffix && !secureTextEntry && (
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.ink55 }}>{suffix}</Text>
        )}
      </View>
      {hint && !error && (
        <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink35, paddingHorizontal: 2 }}>{hint}</Text>
      )}
      {error && (
        <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11.5, color: '#C4611A', paddingHorizontal: 2 }}>{error}</Text>
      )}
    </View>
  );
}
