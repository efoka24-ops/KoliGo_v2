# KoliGo — Application mobile (React Native / Expo)

Code source de l'app mobile KoliGo : livraison collaborative à Douala (vendeurs, livreurs, clients), paiements MTN MoMo / Orange Money, codes de confiance, commission 3%, FR/EN.

> Converti depuis les wireframes « Direction A ». Visuel **hi-fi brandé** (vert forêt + orange), composants réutilisables, navigation par rôle.

## 🚀 Démarrer

```bash
npm install            # ou: yarn
npx expo start         # puis 'i' (iOS), 'a' (Android), ou scanner le QR avec Expo Go
```

Prérequis : Node 18+, et l'app **Expo Go** sur ton téléphone (ou un simulateur iOS/Android).

## 🗂 Structure

```
App.js                         Providers (i18n, store) + NavigationContainer
index.js                       Point d'entrée Expo
app.json / babel.config.js     Config Expo
assets/koligo-logo-1024.png    Logo (icône + splash)
src/
  theme/index.js               Couleurs, typo, spacing, radius, ombres (la charte)
  i18n/                         FR/EN
    index.js                   I18nProvider + hook useI18n() → { lang, t, setLang }
    strings.js                 Toutes les chaînes traduites
  store/index.js               État global léger (rôle vendeur/livreur, statut en ligne)
  components/                  Bibliothèque UI partagée (Button, Card, Pill, Field,
                               CodeBoxes, Numpad, ScreenHeader, Screen, Toggle, Stars…)
  navigation/
    RootNavigator.js           Stack global (onboarding → app → modals)
    VendorTabs.js              Tabs vendeur (Accueil, Historique, Chat, Profil)
    DelivererTabs.js           Tabs livreur (Accueil, Courses, Wallet, Profil)
  screens/
    onboarding/   (11)         Langue, Welcome, Signup, OTP, PIN, Signin, KYC,
                               Localisation, Rôle, Paiement, Maintenance
    vendor/       (7)          Home, PostDelivery, Codes, DeliveryDetail,
                               History, Chat, Profile
    deliverer/    (10)         Home, Available, OfferDetail, ConfirmCode, Waiting,
                               Wallet, Rating, ReportIssue, KycStatus, Profile
    client/       (5)          Landing, Tracking, Reception, Success, Rating
    shared/       (3)          Notifications, Settings, Terms
```

## 🧭 Parcours

- **Démarrage** : `Language → Welcome → Signup → Otp → Pin → Location → RoleSelect → PaymentSetup → (VendorApp | DelivererApp)`.
- **Changer de rôle** : depuis l'en-tête d'accueil ou l'écran Profil (`store.setRole` + `navigation.reset`).
- **Parcours client** (sans compte) : `ClientLanding → ClientTracking → ClientReception → ReceptionSuccess → ClientRating`. En production il s'ouvre via **deep link** (`koligo://...`) depuis le lien partagé par le vendeur ; les écrans sont enregistrés dans le stack pour pouvoir les tester via `navigation.navigate('ClientLanding')`.

## 🌐 Internationalisation (FR/EN)

`useI18n()` expose `t('clé')`, `lang`, et `setLang('fr'|'en')`. La langue est persistée (AsyncStorage) et modifiable en direct dans **Paramètres**. Ajoute tes chaînes dans `src/i18n/strings.js`.

## 🎨 Thème

Tous les tokens sont dans `src/theme/index.js` (couleurs de marque, statuts, typo, ombres, rayons). Les composants lisent ces tokens — change-les une fois, l'app suit.

## 🔌 À brancher (mock → réel)

Le code est volontairement **front-only** avec des données de démonstration. Points d'intégration :
- **API** : remplace les données en dur des écrans par tes appels (REST/GraphQL). `react-query` recommandé.
- **Auth / OTP / PIN** : brancher SMS/WhatsApp + SecureStore pour le PIN, biométrie via `expo-local-authentication`.
- **Carte & GPS** : les `Placeholder map` sont à remplacer par `react-native-maps` + `expo-location` (streaming GPS 8s, polling statut 5s comme spécifié).
- **Paiement** : intégration MTN MoMo / Orange Money + webhook de répartition (vendeur / livreur / KoliGo 3%).
- **State** : `src/store` est un Context minimal ; passe à Zustand/Redux selon tes besoins.

## 📝 Notes

- Polices : le système est utilisé par défaut (zéro asset). Pour coller au design, bundle **Plus Jakarta Sans** via `expo-font` et renseigne `theme.font`.
- Icônes : emojis/glyphes en placeholder dans la TabBar et les listes — remplace par `@expo/vector-icons` (déjà inclus avec Expo).
- Aucune dépendance native non-Expo : compatible **Expo Go** sans build custom (sauf maps/biométrie qui nécessitent un dev build).
```
