import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/colors';
import { KG_WALLET_TX } from '../../constants/data';
import { useApp } from '../../context/AppContext';
import KGTopBar from '../../components/KGTopBar';
import KGButton from '../../components/KGButton';
import KGInput from '../../components/KGInput';
import KGToast from '../../components/KGToast';
import KenteStripe from '../../components/KenteStripe';
import Icon from '../../components/Icon';

const TX_ICON_COLOR = (tx) => {
  if (tx.type === 'withdraw' || tx.type === 'WITHDRAWAL') return { bg: '#FEF0E3', color: '#C4611A' };
  if (tx.type === 'bonus' || tx.type === 'BONUS') return { bg: '#FFF8E3', color: '#D4991A' };
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
    api('/wallet').then(setWalletData).catch(() => {});
  }, [token, isDemo]);

  const balance = isDemo ? 24580 : (walletData?.balance ?? 0);
  const transactions = isDemo
    ? KG_WALLET_TX
    : (walletData?.transactions || []).map(normalizeTransaction);

  const handleWithdraw = async () => {
    if (isDemo) { setWithdrawOpen(false); showToast('Retrait envoyé · arrive sous 1 min ✅'); return; }
    if (!withdrawAmount || parseInt(withdrawAmount) < 500) { showToast('Montant minimum 500 XAF', 'error'); return; }
    const phoneNorm = withdrawPhone.replace(/\s/g, '');
    if (!/^6\d{8}$/.test(phoneNorm)) { showToast('Numéro invalide (format: 6XXXXXXXX)', 'error'); return; }
    setWithdrawLoading(true);
    try {
      await api('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: parseInt(withdrawAmount), provider: withdrawProvider, phone: phoneNorm }),
      });
      setWithdrawOpen(false);
      showToast('Retrait initié · arrive sous 1 min ✅');
      api('/wallet').then(setWalletData).catch(() => {});
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF5E6' }} edges={['top']}>
      {toast && <KGToast message={toast.message} kind={toast.kind} />}
      <KenteStripe height={4} />
      <KGTopBar title="Wallet" />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>

        {/* Balance card — forest dark */}
        <View style={{
          backgroundColor: '#0E2116', borderRadius: 24, padding: 22, overflow: 'hidden',
          shadowColor: '#0E2116', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 10,
        }}>
          <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(13,122,62,0.18)' }} />
          <View style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(212,153,26,0.08)' }} />

          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Solde disponible
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8, marginBottom: 4 }}>
            <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 46, color: '#fff', lineHeight: 50 }}>
              {balance.toLocaleString('fr-FR')}
            </Text>
            <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 16, color: '#D4991A', marginBottom: 8 }}>XAF</Text>
          </View>

          {isDemo && (
            <>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 }} />
              <View style={{ flexDirection: 'row', gap: 24 }}>
                {[{ label: "Aujourd'hui", value: '+5 095', color: '#4EAF74' }, { label: 'Cette semaine', value: '+18 240', color: '#D4991A' }].map(s => (
                  <View key={s.label} style={{ gap: 3 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.06 }}>{s.label}</Text>
                    <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: s.color }}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => setWithdrawOpen(true)}
            style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#C4611A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="upload" size={18} color="#fff" />
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: '#fff' }}>Retirer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.green, backgroundColor: '#EFF8F1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="plus" size={18} color={colors.green} />
            <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 14, color: colors.green }}>Recharger</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 4 }}>
          <Text style={{ fontFamily: `${fonts.ui}-Bold`, fontSize: 11, color: colors.ink55, textTransform: 'uppercase', letterSpacing: 0.08 }}>Transactions</Text>
          <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 12, color: colors.green }}>Tout</Text>
        </View>

        {transactions.length > 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCC8' }}>
            {transactions.map((tx, i) => {
              const { bg, color } = TX_ICON_COLOR(tx);
              return (
                <View key={tx.id} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                  borderBottomWidth: i < transactions.length - 1 ? 1 : 0,
                  borderBottomColor: '#F0E8D8',
                }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={tx.icon} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 14, color: colors.ink }}>{tx.label}</Text>
                    <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 11.5, color: colors.ink55 }}>{tx.date}</Text>
                  </View>
                  <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 15, color: tx.amount < 0 ? '#C4611A' : colors.greenDark }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
            <Icon name="wallet" size={32} color={colors.ink35} />
            <Text style={{ fontFamily: `${fonts.display}-Bold`, fontSize: 16, color: colors.ink }}>Aucune transaction</Text>
            <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, textAlign: 'center', maxWidth: 240, lineHeight: 18 }}>
              Tes gains apparaîtront ici après ta première course.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Withdraw modal */}
      <Modal visible={withdrawOpen} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(14,33,22,0.6)' }} activeOpacity={1} onPress={() => setWithdrawOpen(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.ink12, borderRadius: 2, alignSelf: 'center' }} />
            <KenteStripe height={3} />
            <View>
              <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 22, color: colors.ink, marginTop: 8 }}>Retrait Mobile Money</Text>
              <Text style={{ fontFamily: `${fonts.ui}-Regular`, fontSize: 13, color: colors.ink55, marginTop: 3 }}>Instantané · 0 frais</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { id: 'MTN_MOMO', label: 'MTN MoMo', bg: '#FFCC00', color: '#1A1A1A' },
                { id: 'ORANGE_MONEY', label: 'Orange Money', bg: '#C4611A', color: '#fff' },
              ].map(p => (
                <TouchableOpacity key={p.id} onPress={() => setWithdrawProvider(p.id)}
                  style={{ flex: 1, height: 60, borderRadius: 14, borderWidth: withdrawProvider === p.id ? 2.5 : 1.5, borderColor: withdrawProvider === p.id ? colors.green : '#E8DCC8', backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: `${fonts.display}-ExtraBold`, fontSize: 13, color: p.color }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <KGInput label="Montant (XAF)" value={withdrawAmount} suffix="XAF" keyboardType="numeric" onChangeText={setWithdrawAmount} placeholder="Ex: 5000" />
            <KGInput label="Numéro" value={withdrawPhone} suffix="🇨🇲 +237" keyboardType="phone-pad" onChangeText={setWithdrawPhone} placeholder="6 XX XX XX XX" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.greenLight, borderRadius: 12 }}>
              <Text style={{ fontFamily: `${fonts.ui}-SemiBold`, fontSize: 13, color: colors.greenDark }}>Frais de retrait</Text>
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
