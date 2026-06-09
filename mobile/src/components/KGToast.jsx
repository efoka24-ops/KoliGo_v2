import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const PALETTES = {
  success: { bg: colors.green, color: '#fff', icon: 'check' },
  info:    { bg: colors.ink,   color: '#fff', icon: 'bell' },
  warn:    { bg: colors.orange,color: '#fff', icon: 'bell' },
};

export default function KGToast({ message, kind = 'success' }) {
  const p = PALETTES[kind] || PALETTES.success;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', tension: 80, friction: 8 }).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', top: 16, left: 16, right: 16, zIndex: 100,
      backgroundColor: p.bg, borderRadius: 14, padding: 14,
      flexDirection: 'row', gap: 10, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
    }}>
      <Icon name={p.icon} size={18} color={p.color} />
      <Text style={{ flex: 1, fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: p.color }}>{message}</Text>
    </Animated.View>
  );
}
