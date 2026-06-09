# Implementation Plan: KoliGo Monorepo

**Branch**: `001-koligo-monorepo` | **Date**: 2026-06-09 | **Spec**: specs/001-koligo-monorepo/spec.md

## Summary

Scaffold the KoliGo project as three co-located apps sharing a single git repository:
- `mobile/` — React Native / Expo SDK 51 for Vendor, Deliverer and Client (no account); UI already prototyped
- `backend/` — Express + Prisma + SQLite; single REST API consumed by both mobile and backoffice
- `backoffice/` — React Native admin dashboard for KoliGo operators

The mobile UI prototype (36 screens, all components, FR/EN i18n) is migrated here as-is and wired to real API services. Backend implements the delivery state machine, escrow, GPS cache, KYC, and MoMo payments. Backoffice uses the same API with an admin JWT role.

## Technical Context

**Language/Version**: TypeScript 5 / JavaScript ES2022

**Primary Dependencies**:
- mobile: Expo SDK 51, React Native 0.74, React Navigation 6, Zustand, React Query, i18next, expo-secure-store, expo-location
- backend: Express 4, Prisma 5, better-sqlite3, jsonwebtoken, bcryptjs, CinetPay SDK, ioredis
- backoffice: Expo SDK 51, React Native 0.74, React Navigation 6, Zustand, React Query

**Storage**: SQLite via Prisma (file:./dev.db) for MVP; `DATABASE_URL` env swap to PostgreSQL for prod

**Testing**: Jest + React Native Testing Library (mobile/backoffice); Jest + Supertest (backend)

**Target Platform**: Android 10+ primary (iOS Phase 2); backoffice on tablet + Expo web

**Project Type**: mobile-app + web-service + mobile-admin

**Performance Goals**: API p95 < 300 ms; GPS write < 100 ms; client tracking poll every 10 s

**Constraints**: Offline-tolerant (Zustand cache); 4G Cameroon network (< 1 MB payloads); XAF integer only (no floats)

**Scale/Scope**: MVP ~500 users, 50 concurrent deliveries; 36 mobile screens, ~50 API endpoints, 8 admin modules

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Single responsibility per app | PASS | mobile UI, API server, admin UI are clearly scoped |
| No circular dependencies | PASS | mobile → backend ← backoffice; no shared native code |
| SQLite for MVP | PASS | Prisma datasource `url = "file:./dev.db"` |
| Commission enforced server-side only | PASS | `commissionRate` from PlatformSetting, never client-side |
| Escrow released only on LIVRE | PASS | enforced in backend delivery service |
| KYC gated before first delivery | PASS | `requireKyc` middleware checks `kycStatus === VERIFIED` |

## Project Structure

### Documentation (this feature)

```text
specs/001-koligo-monorepo/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── mobile-screens.md
└── tasks.md             (created by /speckit.tasks)
```

### Source Code (repository root)

```text
Koligo_V2/
│
├── mobile/                              React Native / Expo SDK 51
│   ├── app.json
│   ├── babel.config.js
│   ├── index.js
│   ├── App.tsx
│   ├── package.json
│   ├── assets/
│   │   └── koligo-logo-1024.png
│   └── src/
│       ├── theme/index.ts               brand tokens (colors, type, radius, shadow)
│       ├── i18n/
│       │   ├── index.tsx                I18nProvider + useI18n()
│       │   └── strings.ts              130+ FR/EN keys
│       ├── store/index.tsx              Zustand stores (auth, role, delivery, wallet)
│       ├── services/
│       │   ├── api.ts                   Axios base client + JWT interceptors
│       │   ├── auth.ts                  signup, login, OTP, PIN, refresh
│       │   ├── delivery.ts              CRUD + state transitions
│       │   ├── wallet.ts                balance, transactions, withdraw
│       │   ├── rating.ts                post rating
│       │   ├── geo.ts                   GPS POST every 8 s (EN_ROUTE only)
│       │   └── storage.ts               expo-secure-store wrappers
│       ├── hooks/
│       │   ├── useDeliveries.ts
│       │   ├── useWallet.ts
│       │   └── useLocation.ts
│       ├── components/                  (15 reusable UI primitives)
│       │   ├── Avatar.tsx
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   ├── CodeBoxes.tsx
│       │   ├── Field.tsx
│       │   ├── ListItem.tsx
│       │   ├── Logo.tsx
│       │   ├── Numpad.tsx
│       │   ├── Pill.tsx
│       │   ├── Placeholder.tsx
│       │   ├── Screen.tsx
│       │   ├── ScreenHeader.tsx
│       │   ├── Stars.tsx
│       │   ├── StatCard.tsx
│       │   ├── Toggle.tsx
│       │   └── index.ts
│       ├── navigation/
│       │   ├── RootNavigator.tsx
│       │   ├── VendorTabs.tsx
│       │   └── DelivererTabs.tsx
│       └── screens/
│           ├── onboarding/              (11 screens)
│           ├── vendor/                  (7 screens)
│           ├── deliverer/               (10 screens)
│           ├── client/                  (5 screens)
│           └── shared/                  (3 screens)
│
├── backend/                             Express + Prisma + SQLite
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── server.ts                        entry point (PORT 3000)
│   ├── prisma/
│   │   ├── schema.prisma                18 models
│   │   └── migrations/
│   └── src/
│       ├── app.ts                       Express app factory + middleware
│       ├── api/
│       │   ├── auth.routes.ts           POST /auth/signup|signin|otp|refresh|switch-role
│       │   ├── user.routes.ts           GET|PATCH /user/profile|payment-account|kyc
│       │   ├── delivery.routes.ts       CRUD + /accept|cancel|confirm-collect|confirm-deliver|location
│       │   ├── wallet.routes.ts         GET /wallet + /transactions; POST /wallet/withdraw
│       │   ├── rating.routes.ts         POST /ratings
│       │   ├── issue.routes.ts          POST /issues
│       │   └── admin.routes.ts          GET|PATCH /admin/users|deliveries|kyc|settings|stats
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── delivery.controller.ts
│       │   ├── wallet.controller.ts
│       │   ├── rating.controller.ts
│       │   └── admin.controller.ts
│       ├── services/
│       │   ├── auth.service.ts          OTP (4-digit, 5 min, 3 attempts), PIN bcrypt-12, JWT 15 min/7 d
│       │   ├── delivery.service.ts      state machine + collect/deliver codes + escrow
│       │   ├── pricing.service.ts       (500 + km×150 + kg×100) × typeCoefficient
│       │   ├── payment.service.ts       CinetPay MoMo + webhook + escrow release
│       │   ├── geo.service.ts           Redis GPS write/read (TTL 30 s)
│       │   ├── notify.service.ts        Expo push + WhatsApp / SMS fallback
│       │   └── kyc.service.ts           multer upload + status transition
│       ├── middleware/
│       │   ├── auth.middleware.ts       verifyJWT
│       │   ├── role.middleware.ts       requireRole(role[])
│       │   ├── kyc.middleware.ts        requireKyc()
│       │   └── validate.middleware.ts   zod request validation
│       ├── models/
│       │   └── prisma.ts               PrismaClient singleton
│       └── utils/
│           ├── pricing.ts
│           ├── codes.ts                 crypto 4-digit code generator
│           ├── jwt.ts
│           └── pdf.ts                   trust invoice (pdfkit)
│
└── backoffice/                          React Native admin (Expo SDK 51)
    ├── app.json
    ├── babel.config.js
    ├── index.js
    ├── App.tsx
    ├── package.json
    └── src/
        ├── theme/                       same tokens as mobile
        ├── i18n/                        FR/EN admin strings
        ├── services/
        │   ├── api.ts                   same backend base URL
        │   └── auth.ts                  admin JWT login
        ├── components/
        │   ├── DataTable.tsx
        │   ├── StatCard.tsx
        │   ├── Badge.tsx
        │   └── Chart.tsx
        ├── navigation/
        │   └── AdminTabs.tsx            Dashboard | Users | Deliveries | Finance | Settings
        └── screens/
            ├── LoginScreen.tsx
            ├── DashboardScreen.tsx      live stats + active deliveries
            ├── UsersScreen.tsx          list, search, block/unblock
            ├── UserDetailScreen.tsx     KYC approve / reject + documents
            ├── DeliveriesScreen.tsx     full table with filters
            ├── DeliveryDetailScreen.tsx timeline + force-cancel
            ├── FinanceScreen.tsx        withdrawals + commission ledger
            ├── SettingsScreen.tsx       PlatformSetting key-value editor
            └── MaintenanceScreen.tsx    toggle maintenance_mode flag
```

**Structure Decision**: Three independent Expo projects inside one git repo (no pnpm workspaces for MVP). Each app has its own `node_modules`. Theme tokens and the pricing formula are copied into each project; a `packages/shared` workspace can be extracted once duplication exceeds 3 files.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| 3 separate apps | Mobile, API and admin are independently deployable | A single bundle would mix native runtime with Node.js server |
| SQLite + Redis | Redis is volatile GPS cache (8 s TTL, write-heavy) | SQLite alone serialises GPS writes and breaks location latency target |
