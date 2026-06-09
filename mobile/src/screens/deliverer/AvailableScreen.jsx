import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { KG_AVAILABLE_FOR_DELIVERER } from '../../constants/data'; // Still needed for demo mode
import { useApp, t } from '../../context/AppContext';
import { useDeliveries } from '../../hooks/useDeliveries';
import KGTopBar from '../../components/KGTopBar';
import KGCard from '../../components/KGCard';
import KGChip from '../../components/KGChip';
import KGCourierBadge from '../../components/KGCourierBadge';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'temporaire', label: 'Temporaire' },
  { id: 'permanent', label: 'Permanent' },
  { id: 'express', label: 'Express' },
  { id: 'vvip', label: 'VVIP' },
];

function AvailableCard({ d, onPress }) {
  return (
    <KGCard onPress={onPress} style={styles.availableCard}>
      <View style={styles.availableCardContent}>
        <View style={styles.availableCardLeft}>
          <View style={styles.availableCardHeader}>
            <KGCourierBadge type={d.type} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55 }}>{d.posted}</Text>
          </View>
          <RouteLine from={d.from} to={d.to} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Icon name="package" size={14} color={colors.ink55} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.weight} kg Â· {d.distance} km</Text>
            <Text style={{ color: colors.ink55 }}>Â·</Text>
            <Icon name="star" size={14} color={colors.ink55} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.vendorRating} Â· {d.vendor}</Text>
          </View>
        </View>
        <View style={styles.availableCardRight}>
          <Text style={styles.availableCardPrice}>{d.price.toLocaleString('fr-FR')}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55 }}>XAF</Text>
        </View>
      </View>
    </KGCard>
  );
}

export default function AvailableScreen({ navigation }) {
  const { token, api, user, showToast } = useApp();
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const { deliveries, loading, fetchDeliveries } = useDeliveries();

  const loadDeliveries = useCallback(() => {
    fetchDeliveries({ mode: 'available' });
  }, [fetchDeliveries]);

  // Refresh function
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeliveries();
    setRefreshing(false);
  }, [loadDeliveries]);

  useEffect(() => {
    loadDeliveries();
    const unsub = navigation.addListener('focus', loadDeliveries);
    return unsub;
  }, [loadDeliveries, navigation]);

  const filtered = (deliveries || []).filter(d => filter === 'all' || d.type === filter);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KGTopBar
        title={t('Courses disponibles')}
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DelivererHome')}
        action={
          refreshing
            ? <ActivityIndicator size="small" color={colors.ink} />
            : <TouchableOpacity onPress={refresh}><Icon name="history" size={20} color={colors.ink} /></TouchableOpacity>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
        {FILTERS.map(f => (
          <KGChip key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>{f.label}</KGChip>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.deliveriesListContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.deliveriesCountText}>
            {t('{{count}} course{{plural}} dans ta zone', { count: filtered.length, plural: filtered.length > 1 ? 's' : '' })}
          </Text>
          {filtered.length === 0 && (
            <View style={styles.emptyListContainer}>
              <View style={styles.emptyListIconContainer}>
                <Icon name="moto" size={24} color={colors.ink35} />
              </View>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink55 }}>Aucune course disponible</Text>
            </View>
          )}
          {filtered.map(d => (
            <AvailableCard
              key={d.id} d={d}
              onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id, mode: 'available' })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveriesListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  deliveriesCountText: {
    fontFamily: `${fonts.ui}-Regular`,
    fontSize: 12,
    color: colors.ink55,
    paddingHorizontal: 4,
  },
  emptyListContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyListIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink12,
    borderStyle: 'dashed',
  },
  availableCard: {
    // Styles for KGCard are already handled by the component itself
  },
  availableCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  availableCardLeft: {
    flex: 1,
  },
  availableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  availableCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  availableCardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  availableCardPrice: {
    fontFamily: `${fonts.display}-ExtraBold`,
    fontSize: 18,
    color: colors.green,
    letterSpacing: -0.02,
  },
});
