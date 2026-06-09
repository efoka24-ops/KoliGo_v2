import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/colors';
import { KG_WALLET_TX } from '../constants/data';
import { useApp } from '../context/AppContext';
import KGTopBar from '../components/KGTopBar';
import KGButton from '../components/KGButton';
import KGCard from '../components/KGCard';
import KGSectionTitle from '../components/KGSectionTitle';
import KGInput from '../components/KGInput';
import KGToast from '../components/KGToast';
import KGTabBar from '../components/KGTabBar';
import Icon from '../components/Icon';

const TX_ICON_COLOR = (tx) => {
  if (tx.type === 'withdraw') return { bg: colors.orangeLight, color: colors.orange };
  if (tx.type === 'bonus') return { bg: '#FFF7E8', color: '#B4881C' };
  return { bg: colors.greenLight, color: colors.greenDark };
};

function normalizeTransaction(tx) {
  const date = tx.createdAt
    ? new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '';
  const icon = tx.type === 'WITHDRAWAL' || tx.type === 'withdraw' ? 'upload'
    : tx.type === 'BONUS' || tx.type === 'bonus' ? 'sparkle' : 'check';
  return {
    id: tx.id, label: tx.label || tx.reference || 'Transaction',
    amount: tx.amount, date, icon,
    type: (tx.type || '').toLowerCase(),
  };
}

export default function WalletScreen({ navigation }) {
  const { toast, showToast, user, token, api } = useApp();
  const isDemo = user?.isTest === true;
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [walletData, setWalletData] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState('MTN_MOMO');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    if (isDemo || !token) return;
    api('/api/wallet').then(setWalletData).catch(() => {});
  }, [token, isDemo]);

  const balance = isDemo ? 24580 : (walletData?.balance ?? 0);
  const transactions = isDemo
    ? KG_WALLET_TX
    : (walletData?.transactions || []).map(normalizeTransaction);

  const handleTab = (tab) => {
    if (tab === 'home') navigation.navigate('DelivererHome');
    else if (tab === 'chat') navigation.navigate('ChatInbox');
    else if (tab === 'profile') navigation.navigate('Profile');
  };

  const handleWithdraw = async () => {
    if (isDemo) {
      setWithdrawOpen(false);
      showToast('Retrait envoyé · arrive sous 1 min ✅');
      return;
    }
    if (!withdrawAmount || parseInt(withdrawAmount) < 500) {
      showToast('Montant minimum 500 XAF', 'error'); return;
    }
    const phoneNorm = withdrawPhone.replace(/\s/g, '');
    if (!/^6\d{8}$/.test(phoneNorm)) {
      showToast('Numéro invalide (format: 6XXXXXXXX)', 'error'); return;
    }
    setWithdrawLoading(true);
    try {
      await api('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: parseInt(withdrawAmount), provider: withdrawProvider, phone: phoneNorm }),
      });
      setWithdrawOpen(false);
      showToast('Retrait initié · arrive sous 1 min ✅');
      api('/api/wallet').then(setWalletData).catch(() => {});
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}

      <KGTopBar title="Wallet" onBack={() => navigation.goBack()} action={<Icon name="settings" size={20} color={colors.ink} />} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>

        {/* Balance card */}
        <KGCard kind="dark" padding={20} style={{ overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(13,122,62,0.22)' }} />
          <View>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Solde disponible</Text>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 48, color: '#fff', letterSpacing: -0.04 * 48, lineHeight: 52, marginTop: 6 }}>
              {balance.toLocaleString('fr-FR')} <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)' }}>XAF</Text>
            </Text>
            {isDemo && (
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
                {[
                  { label: "Aujourd'hui", value: '+5 095' },
                  { label: 'Cette semaine', value: '+18 240' },
                ].map(s => (
                  <View key={s.label} style={{ gap: 2 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.04 }}>{s.label}</Text>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: colors.orange }}>{s.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </KGCard>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KGButton kind="orange" icon="upload" style={{ flex: 1 }} onPress={() => setWithdrawOpen(true)}>Retirer</KGButton>
          <KGButton kind="ghost" icon="plus" style={{ flex: 1 }} onPress={() => {}}>Recharger</KGButton>
        </View>

        <KGSectionTitle>Transactions</KGSectionTitle>

        {transactions.length > 0 ? (
          <KGCard padding={0}>
            {transactions.map((tx, i) => {
              const { bg, color } = TX_ICON_COLOR(tx);
              return (
                <View key={tx.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i < transactions.length - 1 ? 1 : 0, borderBottomColor: colors.ink06 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={tx.icon} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{tx.label}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink55 }}>{tx.date}</Text>
                  </View>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 14.5, color: tx.amount < 0 ? colors.orange : colors.greenDark }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')}
                  </Text>
                </View>
              );
            })}
          </KGCard>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink12, borderStyle: 'dashed' }}>
              <Icon name="wallet" size={28} color={colors.ink35} />
            </View>
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>Aucune transaction</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 240, lineHeight: 18 }}>
              Tes gains apparaîtront ici après ta première course.
            </Text>
          </View>
        )}
      </ScrollView>

      <KGTabBar active="wallet" onTab={handleTab} role="deliverer" />

      {/* Withdraw modal */}
      <Modal visible={withdrawOpen} transparent animationType="none">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setWithdrawOpen(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.ink12, borderRadius: 2, alignSelf: 'center' }} />
            <View>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, letterSpacing: -0.02 * 22 }}>Retirer en Mobile Money</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink70, marginTop: 4 }}>Instantané · 0 frais</Text>
            </View>

            {/* Provider selection */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', bg: '#FFCC00', color: '#1A1A1A' },
                { id: 'ORANGE_MONEY', label: 'Orange Money', bg: colors.orange, color: '#fff' },
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setWithdrawProvider(p.id)}
                  style={{ flex: 1, height: 64, borderRadius: 14, borderWidth: withdrawProvider === p.id ? 2.5 : 1.5, borderColor: withdrawProvider === p.id ? colors.green : colors.ink12, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 14, color: p.color }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <KGInput label="Montant" value={withdrawAmount} suffix="XAF" keyboardType="numeric" onChangeText={setWithdrawAmount} placeholder="Ex: 5000" />
            <KGInput label="Numéro" value={withdrawPhone} suffix="🇨🇲 +237" keyboardType="phone-pad" onChangeText={setWithdrawPhone} placeholder="6 XX XX XX XX" />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.greenLight, borderRadius: 10 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.greenDark }}>Frais</Text>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 16, color: colors.greenDark }}>0 XAF</Text>
            </View>

            <KGButton kind="primary" size="lg" icon={withdrawLoading ? undefined : 'check'} onPress={handleWithdraw} disabled={withdrawLoading}>
              {withdrawLoading ? <ActivityIndicator color="#fff" /> : 'Confirmer le retrait'}
            </KGButton>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
