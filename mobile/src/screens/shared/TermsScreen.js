import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, ScreenHeader, Card, Button } from '../../components';
import { colors, type } from '../../theme';
import { useI18n } from '../../i18n';

export default function TermsScreen({ navigation }) {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState(false);
  return (
    <Screen footer={<Button title={t('continue')} disabled={!accepted} onPress={() => navigation.goBack()} />}>
      <ScreenHeader title={t('terms')} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 18, paddingTop: 6, gap: 14 }}>
        <Text style={type.h2}>1. Service</Text>
        <Text style={type.lead}>
          KoliGo met en relation vendeurs, livreurs et clients pour la livraison de colis à Douala. La plateforme
          prélève une commission de 3% sur chaque livraison confirmée par code de réception.
        </Text>
        <Text style={type.h2}>2. Paiements</Text>
        <Text style={type.lead}>
          Les paiements sont opérés via MTN MoMo et Orange Money. La répartition est automatique entre le vendeur,
          le livreur et la plateforme dès la confirmation de réception.
        </Text>
        <Text style={type.h2}>3. Données & KYC</Text>
        <Text style={type.lead}>
          Les vendeurs et livreurs fournissent une pièce d'identité (CNI) et un selfie pour vérification. Ces données
          sont conservées de façon sécurisée et utilisées uniquement pour la conformité.
        </Text>
        <Pressable onPress={() => setAccepted((a) => !a)}>
          <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.box, accepted && { backgroundColor: colors.green, borderColor: colors.green }]}>
              {accepted ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}
            </View>
            <Text style={[type.lead, { flex: 1 }]}>J'ai lu et j'accepte les CGU & la politique de confidentialité.</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
