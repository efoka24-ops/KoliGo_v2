# KoliGo V2

Plateforme collaborative de livraison last-mile pour le Cameroun.

## Architecture

Monorepo avec trois packages indépendants :

```
KoliGo_V2/
├── mobile/        React Native (Expo SDK 51) — app vendeur + livreur
├── backend/       Express + Prisma + SQLite   — API REST
└── backoffice/    React Native (Expo SDK 51) — admin
```

## Stack technique

| Couche | Technologie |
|---|---|
| Mobile | React Native 0.74, Expo SDK 51, React Navigation 6 |
| État | Zustand (auth, présence) + React Query (server state) |
| Backend | Node.js, Express 4, Prisma 5, SQLite (→ PostgreSQL en prod) |
| Auth | JWT 15 min access + 7 j refresh, OTP 4 chiffres par SMS/WhatsApp |
| Paiements | MTN MoMo + Orange Money |
| GPS | POST toutes les 8 s, cache Redis TTL 30 s, poll client toutes les 10 s |
| Backoffice | React Native admin, React Query, SecureStore |

## Démarrage rapide

### Prérequis

- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
cd backend
npm install
cp .env.example .env          # remplir JWT_ACCESS_SECRET et JWT_REFRESH_SECRET
npx prisma migrate dev --name init
npm run db:seed               # crée admin + 3 vendors + 3 livreurs
npm run dev                   # http://localhost:3000
```

### Mobile

```bash
cd mobile
npm install
npx expo start
# Scanner le QR avec Expo Go (Android/iOS)
```

### Backoffice

```bash
cd backoffice
npm install
npx expo start
```

## Comptes de test (PIN : 1234)

| Rôle | Téléphone |
|---|---|
| Admin | +237 600 000 001 |
| Vendeur | +237 655 111 222 |
| Livreur | +237 677 234 567 |

## Modèle économique

Commission KoliGo : **3 %** du montant de la livraison.  
Exemple : livraison à 2 500 XAF → commission 75 XAF → livreur reçoit 2 425 XAF.

## Machine à états — Livraison

```
EN_ATTENTE ──accept──► ACCEPTE ──start──► EN_ROUTE ──confirmDeliver──► LIVRE
     │                    │
   annule               annule (vendeur uniquement)
     ▼                    ▼
  ANNULE               ANNULE
```

## API principale (base : `/api`)

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/request-otp` | Demande OTP |
| POST | `/auth/verify-otp` | Vérification OTP + tokens |
| POST | `/auth/refresh` | Renouvellement access token |
| GET | `/deliveries` | Liste des livraisons (filtre par statut) |
| POST | `/deliveries` | Créer une livraison |
| PATCH | `/deliveries/:id/accept` | Livreur accepte |
| PATCH | `/deliveries/:id/confirm-collect` | Validation code collecte |
| PATCH | `/deliveries/:id/confirm-deliver` | Validation code livraison + escrow |
| GET | `/deliveries/track/:token` | Tracking client sans compte |
| GET | `/wallet/balance` | Solde portefeuille |
| POST | `/wallet/withdraw` | Retrait MoMo/Orange |
| GET | `/admin/stats` | Statistiques plateforme |
| GET | `/admin/users` | Liste utilisateurs |
| PATCH | `/admin/users/:id/kyc` | Approuver/rejeter KYC |
| PATCH | `/admin/users/:id/block` | Bloquer/débloquer compte |
| GET | `/admin/settings` | Paramètres plateforme |
| PATCH | `/admin/settings/:key` | Modifier un paramètre |

## Structure mobile/src

```
src/
├── screens/
│   ├── onboarding/   Welcome, Auth, Verification, KYC, ProfileChoice, Language, Permissions
│   ├── vendor/       VendorHome, PostDelivery, VendorCodes
│   ├── deliverer/    DelivererHome, DelivererWaiting, Available
│   ├── client/       ClientLanding, ClientTracking, ClientReception, ClientReceptionSuccess
│   └── shared/       DeliveryDetail, Wallet, History, Chat, Rating, ReportIssue, Profile…
├── components/       KGButton, KGCard, KGInput, KGTopBar, LiveMap, KoliGoLogo…
├── services/         api.ts, auth.ts, delivery.ts, geo.ts, wallet.ts, rating.ts
├── store/            useAuthStore, usePresenceStore (Zustand)
├── hooks/            useDeliveries, useLocation, useWallet
├── navigation/       AppNavigator
├── theme/            tokens de marque (couleurs, espacements, typographie)
└── i18n/             traductions FR/EN (130+ clés)
```

## Variables d'environnement (backend)

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_ACCESS_SECRET=changeme_access
JWT_REFRESH_SECRET=changeme_refresh
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
PORT=3000
REDIS_URL=redis://localhost:6379
```

## Roadmap

- [ ] Intégration MTN MoMo API réelle
- [ ] Notifications push (Expo Push + FCM)
- [ ] Chat temps réel (Socket.IO)
- [ ] Migration PostgreSQL (production)
- [ ] Tests E2E
