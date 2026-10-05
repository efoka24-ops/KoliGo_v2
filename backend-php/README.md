# KoliGo — backend PHP

Réécriture du backend Express/Prisma en PHP 8.1 pur (sans Composer), pour l'hébergement mutualisé
`koligo.trugroup.cm`. **Même API** que l'ancien backend (mêmes routes, avec et sans préfixe `/api`),
l'app mobile n'a donc besoin que d'un changement : l'intercepteur de surcharge de méthode (voir plus bas).

```
app/            code, config, vues, schéma — jamais servi (app/.htaccess : Require all denied)
  src/          Router, Db (PDO), Jwt, Auth, services (Sungku, Payments, Deliveries…), contrôleurs
  database/     schema.sql (MySQL/SQLite), geo.json (17 villes, 270 quartiers)
  .env.php      secrets de prod (hors dépôt) — voir app/.env.example
public_html/    index.php, .htaccess, _setup.php (installation à usage unique)
tests/          api_test.php (local, 109 tests), smoke_prod.php (serveur réel), fake_sungku.php
deploy/         ftp-deploy.sh
```

Sur le serveur, le docroot est la **racine FTP** (`/home/trugro9159/koligo`) : `public_html/*` y est déposé
à la racine et `app/` à côté. C'est `app/.htaccess` qui l'isole du web.

## Local

```bash
php app/bin/setup.php --admin=+237600000001:MON_PIN --demo   # DB_DRIVER=sqlite dans app/.env
php -S 127.0.0.1:3001 -t public_html public_html/index.php
php -S 127.0.0.1:8099 tests/fake_sungku.php                  # faux Sungku
php tests/api_test.php
```

## Déploiement

```bash
FTP_HOST=ftp-12.camoo.net FTP_USER=... FTP_PASS=... deploy/ftp-deploy.sh --env app/.env.php [--setup]
# --setup : envoie _setup.php ; l'appeler une fois : /_setup.php?token=<SETUP_TOKEN> (il se supprime)
BASE=https://koligo.trugroup.cm ADMIN_PIN=... php tests/smoke_prod.php   # CLEANUP=1 pour nettoyer
```

## Particularités de l'hébergeur

- **PUT / PATCH / DELETE sont rejetés (403 Apache) avant PHP.** Les clients envoient `POST` +
  `X-HTTP-Method-Override: PATCH|PUT|DELETE` ; le backend le traite (`bootstrap.php`).
  Mobile : fait dans `mobile/src/services/api.ts`. Back-office : à ajouter dans `src/api.js`
  (intercepteur de requête, même logique).
- `Options -Indexes` dans `.htaccess` provoque un 500 : ne pas l'utiliser.
- FTP sans TLS (le serveur refuse `AUTH TLS`).

## Paiement Sungku

Le backend ne parle qu'à Sungku (`SUNGKU_BASE_URL`), jamais à pawaPay.

| Étape | Implémentation |
|---|---|
| Initiation | `Sungku::initiateDeposit` → `POST /api/partners/deposits`, en-tête `X-Api-Key` |
| Montant | toujours calculé côté serveur ; ligne `PENDING` écrite **avant** l'appel |
| Refus (4xx hors 429) | `SungkuRejected` → `FAILED` immédiat |
| Doute (timeout, 5xx, 429, réseau) | `SungkuUnavailable` → reste `PENDING`, jamais d'échec supposé |
| Confirmation | `POST /payments/webhook/sungku` (alias `/payment/…`, `/api/…`) |
| Signature | `sha256=HMAC(secret, "$ts.$rawBody")`, `hash_equals`, en-têtes `X-Apisungku-Timestamp/Signature` |
| Statuts | `CONFIRMED` (aussi `COMPLETED`/`SUCCESS`) = réussi ; `FAILED/REJECTED/CANCELLED/EXPIRED` = échec ; le reste est ignoré |
| Idempotence | `UPDATE … WHERE status='PENDING'` : un rejeu ne change rien |

Non vérifié avec un vrai paiement : le vocabulaire exact des statuts et la forme du JSON du webhook
(le code est tolérant : `data.*` ou racine, `reference`/`externalReference`, `id`/`depositId`).
Les **retraits** ne sont pas automatisés (aucun endpoint de versement documenté) : ligne `PENDING`,
réglée par un admin (`PATCH /admin/withdrawals/:id/pay`).

## Corrections par rapport à l'ancien backend

Inscription avec `role: "ADMIN"` et `switch-role` vers ADMIN (élévation de privilèges) refusés ;
`PATCH /user/profile` en liste blanche (plus d'écriture libre de `kycStatus`, `roles`, `pinHash`) ;
limitation de débit sur connexion/OTP (PIN à 4 chiffres) ; accept/annulation/crédit livreur atomiques
(plus de double crédit webhook + confirmation manuelle) ; retrait à débit conditionnel ; OTP jamais
renvoyés par `/admin/security-events` ; export sans `pinHash` ; uploads KYC limités aux vrais JPEG/PNG.
Stats : le gain du jour compte `EARNING` (l'ancien code cherchait `DELIVERY_EARNING`, jamais écrit).
