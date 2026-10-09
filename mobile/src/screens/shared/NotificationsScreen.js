import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import Icon from '../../components/Icon';

const ICON = {
  NEW_DELIVERY: 'package', DELIVERY_ACCEPTED: 'check', DELIVERY_PICKED_UP: 'bolt', DELIVERY_DELIVERED: 'check',
  DELIVERY_CANCELLED: 'bell', REVISION_PROPOSED: 'bell', REVISION_ACCEPTED: 'check', REVISION_REFUSED: 'bell',
  EARNING: 'wallet', TOPUP: 'wallet', WITHDRAWAL: 'wallet', KYC: 'id', ADMIN: 'bell',
};

function when(iso) {
  const t = new Date(String(iso).replace(' ', 'T').replace(/Z?$/, 'Z'));
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (mins < 1440) return `il y a ${Math.round(mins / 60)} h`;
  return t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen({ navigation }) {
  const { notifications, unreadCount, refreshNotifications, markNotificationsRead } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <KGTopBar
        title="Notifications"
        onBack={() => navigation.goBack()}
        action={unreadCount > 0 ? (
          <TouchableOpacity onPress={() => markNotificationsRead()}>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>Tout lire</Text>
          </TouchableOpacity>
        ) : null}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, gap: 10 }}>
            <Icon name="bell" size={32} color={colors.ink35} />
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>Aucune notification</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 260 }}>
              Les nouvelles courses, acceptations, livraisons et messages de KoliGo apparaîtront ici.
            </Text>
          </View>
        ) : notifications.map((n) => (
          <TouchableOpacity
            key={n.id}
            activeOpacity={0.85}
            onPress={() => !n.read && markNotificationsRead([n.id])}
            style={{
              flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1,
              backgroundColor: n.read ? '#fff' : '#EFF8F1', borderColor: n.read ? '#E8DCC8' : colors.green,
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICON[n.type] || 'bell'} size={18} color={colors.greenDark} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.ink }}>{n.title}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, lineHeight: 18 }}>{n.body}</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55, marginTop: 2 }}>{when(n.createdAt)}</Text>
            </View>
            {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginTop: 6 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
