import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../constants/colors';
import Icon from './Icon';

const VENDOR_TABS = [
  { id: 'home',    icon: 'home',    label: 'Accueil' },
  { id: 'history', icon: 'history', label: 'Historique' },
  { id: 'chat',    icon: 'chat',    label: 'Messages' },
  { id: 'profile', icon: 'user',    label: 'Profil' },
];

const DELIVERER_TABS = [
  { id: 'home',    icon: 'home',   label: 'Courses' },
  { id: 'wallet',  icon: 'wallet', label: 'Wallet' },
  { id: 'chat',    icon: 'chat',   label: 'Messages' },
  { id: 'profile', icon: 'user',   label: 'Profil' },
];

export default function KGTabBar({ active, onTab, role = 'vendor' }) {
  const tabs = role === 'vendor' ? VENDOR_TABS : DELIVERER_TABS;
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
      backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.ink06,
      paddingTop: 6, paddingBottom: 4,
    }}>
      {tabs.map(t => {
        const active_ = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onTab && onTab(t.id)}
            style={{ alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 6, flex: 1 }}
          >
            <View style={{
              width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active_ ? colors.greenLight : 'transparent',
            }}>
              <Icon name={t.icon} size={20} color={active_ ? colors.green : colors.ink55} strokeWidth={active_ ? 2 : 1.7} />
            </View>
            <Text style={{
              fontFamily: active_ ? `${fonts.ui}-Bold` : `${fonts.ui}-Medium`,
              fontSize: 11, color: active_ ? colors.greenDark : colors.ink55,
            }}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
