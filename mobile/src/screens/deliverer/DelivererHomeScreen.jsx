import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { useApp, t } from '../../context/AppContext';
import { useDeliveries } from '../../hooks/useDeliveries';
import KGCard from '../../components/KGCard';
import KGTabBar from '../../components/KGTabBar';
import KGCourierBadge from '../../components/KGCourierBadge';
import KGSectionTitle from '../../components/KGSectionTitle';
import KGToast from '../../components/KGToast';
import RouteLine from '../../components/RouteLine';
import Icon from '../../components/Icon';
import DemoDrawer from '../../components/DemoDrawer';
import { useI18n } from '../../i18n';
function StatCard({ label, value }) {
  return (
    <KGCard padding={12} style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: colors.ink55 }}>{label}</Text>
      <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.ink, letterSpacing: -0.01 }}>{value}</Text>
    </KGCard>
  );
}

function AvailableCard({ d, onPress }) {
  return (
    <KGCard onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <KGCourierBadge type={d.type} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11, color: colors.ink55 }}>{d.posted}</Text>
          </View>
          <RouteLine from={d.from} to={d.to} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Icon name="package" size={14} color={colors.ink55} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.weight} kg Â· {d.distance} km</Text>
            <Text style={{ color: colors.ink55 }}>Â·</Text>
            <Icon name="star" size={14} color={colors.ink55} />
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 12, color: colors.ink55 }}>{d.vendorRating}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 18, color: colors.green, letterSpacing: -0.02 }}>{d.price.toLocaleString('fr-FR')}</Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: colors.ink55 }}>XAF</Text>
        </View>
      </View>
    </KGCard>
  );
}

export default function DelivererHomeScreen({ navigation }) {
  const { toast, user, token, api } = useApp();`n  const { t } = useI18n();
  const displayName = user?.name || t('Mon compte');
  const avatar = user?.avatar || '??';
  const isDemo = user?.isTest === true;
  const [online, setOnline] = useState(true); // This state should probably come from the backend or a global context
  const [stats, setStats] = useState(null);

  const { deliveries: availableDeliveries, loading: loadingDeliveries, fetchDeliveries } = useDeliveries();

  const fetchStats = useCallback(async () => {
    if (isDemo || !token) return;
    try {
      const data = await api('/api/users/me/stats');
      setStats(data);
    } catch (err) { console.error(err); }
  }, [api, isDemo, token]);

  useEffect(() => {
    const loadData = () => { fetchDeliveries({ mode: 'available' }); fetchStats(); };
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [fetchDeliveries, fetchStats, navigation]);

  const handleTab = (tab) => {
    if (tab === 'wallet') navigation.navigate('Wallet');
    else if (tab === 'chat') navigation.navigate('ChatInbox');
    else if (tab === 'profile') navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}

      {/* Header */}
      <View style={styles.header}> {/* Assuming styles.header is defined */}
        <View style={styles.headerLeft}> {/* Assuming styles.headerLeft is defined */}
          <View style={styles.avatarContainer}> {/* Assuming styles.avatarContainer is defined */}
            <View style={styles.avatar}> {/* Assuming styles.avatar is defined */}
              <Text style={styles.avatarText}>{avatar}</Text> {/* Assuming styles.avatarText is defined */}
            </View>
            <View style={[styles.onlineIndicator, { backgroundColor: online ? '#22C55E' : colors.ink35 }]} /> {/* Assuming styles.onlineIndicator is defined */}
          </View>
          <View>
            <Text style={styles.headerStatus}>{online ? t('Tu es en ligne Â· Akwa') : t('Hors ligne')}</Text> {/* Assuming styles.headerStatus is defined */}
            <Text style={styles.headerDisplayName}>{displayName}</Text> {/* Assuming styles.headerDisplayName is defined */}
          </View>
        </View>
        <TouchableOpacity onPress={() => setOnline(o => !o)} style={[styles.onlineToggle, { backgroundColor: online ? colors.green : colors.ink06 }]}> {/* Assuming styles.onlineToggle is defined */}
          <View style={[styles.onlineToggleDot, { backgroundColor: online ? '#fff' : colors.ink70 }]} /> {/* Assuming styles.onlineToggleDot is defined */}
          <Text style={[styles.onlineToggleText, { color: online ? '#fff' : colors.ink70 }]}>{online ? t('ON') : t('OFF')}</Text> {/* Assuming styles.onlineToggleText is defined */}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}> {/* Assuming styles.scrollViewContent is defined */}

        {/* Wallet card */}
        <TouchableOpacity onPress={() => navigation.navigate('Wallet')} activeOpacity={0.9} style={styles.walletCard}> {/* Assuming styles.walletCard is defined */}
          <View style={styles.walletCardBgDecoration1} /> {/* Assuming styles.walletCardBgDecoration1 is defined */}
          <View style={styles.walletCardBgDecoration2} /> {/* Assuming styles.walletCardBgDecoration2 is defined */}
          <View style={styles.walletCardHeader}> {/* Assuming styles.walletCardHeader is defined */}
            <Text style={styles.walletCardTitle}>{t('Mon wallet')}</Text> {/* Assuming styles.walletCardTitle is defined */}
            <Icon name="wallet" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.walletCardBalance}> {/* Assuming styles.walletCardBalance is defined */}
              {(isDemo ? 24580 : (stats?.balance ?? 0)).toLocaleString('fr-FR')} <Text style={styles.walletCardCurrency}>XAF</Text> {/* Assuming styles.walletCardCurrency is defined */}
            </Text>
            <View style={styles.walletCardStats}> {/* Assuming styles.walletCardStats is defined */}
              {isDemo ? (
                <>
                  <Text style={styles.walletCardStatText}>{t('+5 095 aujourd\'hui')}</Text> {/* Assuming styles.walletCardStatText is defined */}
                  <Text style={styles.walletCardStatSeparator}>Â·</Text> {/* Assuming styles.walletCardStatSeparator is defined */}
                  <Text style={styles.walletCardStatText}>{t('3 courses')}</Text>
                </>
              ) : stats ? (
                <>
                  <Text style={styles.walletCardStatText}>{t('+{{amount}} XAF aujourd\'hui', { amount: (stats.gainsToday || 0).toLocaleString('fr-FR') })}</Text>
                  <Text style={styles.walletCardStatSeparator}>Â·</Text>
                  <Text style={styles.walletCardStatText}>{t('{{count}} courses', { count: stats.courses || 0 })}</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.walletCardActions}> {/* Assuming styles.walletCardActions is defined */}
            <View style={styles.walletCardActionButton}> {/* Assuming styles.walletCardActionButton is defined */}
              <Icon name="upload" size={14} color="#fff" strokeWidth={2.2} />
              <Text style={styles.walletCardActionButtonText}>{t('Retirer')}</Text> {/* Assuming styles.walletCardActionButtonText is defined */}
            </View>
            <View style={styles.walletCardActionButtonGhost}> {/* Assuming styles.walletCardActionButtonGhost is defined */}
              <Icon name="history" size={14} color="#fff" strokeWidth={2} />
              <Text style={styles.walletCardActionButtonText}>{t('Historique')}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}> {/* Assuming styles.statsRow is defined */}
          <StatCard label={t('Courses')} value={isDemo ? '3' : String(stats?.courses ?? 0)} loading={!isDemo && !stats} />
          <StatCard label={t('Note')} value={isDemo ? '4.9 â˜…' : (stats?.note ? `${stats.note} â˜…` : 'â€”')} loading={!isDemo && !stats} />
          <StatCard label={t('Acceptation')} value={isDemo ? '92%' : (stats?.acceptation != null ? `${stats.acceptation}%` : 'â€”')} loading={!isDemo && !stats} />
        </View>

        {(() => {
          const list = isDemo ? KG_AVAILABLE_FOR_DELIVERER : availableDeliveries;
          return (
            <>
              <KGSectionTitle action={list.length > 0 ? { label: 'Voir tout', onPress: () => navigation.navigate('Available') } : undefined}>
                {list.length > 0 ? t('Courses dispo Â· {{count}}', { count: list.length }) : t('Courses disponibles')}
              </KGSectionTitle>
              {list.length > 0 ? (
                <View style={styles.availableDeliveriesList}> {/* Assuming styles.availableDeliveriesList is defined */}
                  {list.slice(0, 3).map(d => (
                    <AvailableCard
                      key={d.id} d={d}
                      onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: d.id, mode: 'available' })}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyListContainer}> {/* Assuming styles.emptyListContainer is defined */}
                  <View style={styles.emptyListIconContainer}> {/* Assuming styles.emptyListIconContainer is defined */}
                    <Icon name="moto" size={24} color={colors.ink35} /> {/* Assuming Icon component handles color */}
                  </View>
                  <Text style={styles.emptyListText}>{t('Aucune course disponible pour le moment')}</Text> {/* Assuming styles.emptyListText is defined */}
                </View>
              )}
            </>
          );
        })()}

        {isDemo && (
          <KGCard kind="cream" padding={14} style={styles.bonusCard}> {/* Assuming styles.bonusCard is defined */}
            <View style={styles.bonusCardContent}> {/* Assuming styles.bonusCardContent is defined */}
              <View style={styles.bonusCardIconContainer}> {/* Assuming styles.bonusCardIconContainer is defined */}
                <Icon name="bolt" size={18} color="#fff" />
              </View>
              <View style={styles.bonusCardTextContainer}> {/* Assuming styles.bonusCardTextContainer is defined */}
                <Text style={styles.bonusCardTitle}>{t('+2000 XAF en bonus')}</Text> {/* Assuming styles.bonusCardTitle is defined */}
                <Text style={styles.bonusCardDescription}> {/* Assuming styles.bonusCardDescription is defined */}
                  Atteins 10 courses aujourd'hui â€” il t'en reste 7. Vas-y go-go !
                </Text>
              </View>
            </View>
          </KGCard>
        )}

        {!isDemo && token && !stats?.courses && ( // Show this card only if not in demo and no courses yet
          <KGCard kind="green" padding={14} style={styles.startDeliveringCard}> {/* Assuming styles.startDeliveringCard is defined */}
            <View style={styles.startDeliveringCardContent}> {/* Assuming styles.startDeliveringCardContent is defined */}
              <View style={styles.startDeliveringCardIconContainer}> {/* Assuming styles.startDeliveringCardIconContainer is defined */}
                <Icon name="bolt" size={18} color="#fff" />
              </View>
              <View style={styles.startDeliveringCardTextContainer}> {/* Assuming styles.startDeliveringCardTextContainer is defined */}
                <Text style={styles.startDeliveringCardTitle}>{t('Commence Ã  livrer !')}</Text> {/* Assuming styles.startDeliveringCardTitle is defined */}
                <Text style={styles.startDeliveringCardDescription}> {/* Assuming styles.startDeliveringCardDescription is defined */}
                  Active toi et accepte ta premiÃ¨re course pour gagner ton premier XAF.
                </Text>
              </View>
            </View>
          </KGCard>
        )}

      </ScrollView>

      <KGTabBar active="home" onTab={handleTab} role="deliverer" />
      {isDemo && <DemoDrawer navigation={navigation} />}
    </SafeAreaView>
  );
}
