# Suivi d'usage KoliGo

Mesure de l'expérience client : l'application remonte au serveur ce que fait l'utilisateur (écrans vus, actions, erreurs), et le back-office (menu **Suivi d'usage**) en tire des statistiques, des entonnoirs et le parcours d'un utilisateur.

## Principe

```
Application ──(lots de 50 évènements, toutes les 20 s)──> POST /analytics/events ──> table AnalyticsEvent
Serveur (paiement, livraison, KYC) ───────────────────────────────────────────────> table AnalyticsEvent
Back-office ──> GET /admin/usage/overview | events | journey
```

- **Plan de marquage** : `backend-php/app/database/tracking_plan.json` est la référence unique (60 évènements, 5 entonnoirs). Le serveur **refuse** tout évènement absent du plan. Le même fichier alimente le back-office et les exports CSV.
- **Session** : période d'activité ; une nouvelle session commence après 30 minutes d'inactivité.
- **Appareil** : identifiant aléatoire créé au premier lancement (pas l'identifiant matériel).
- **Identité** : jamais envoyée par l'application. Le serveur lit l'utilisateur dans le jeton de connexion, si l'appel en porte un.

## Confidentialité

- Aucun numéro de téléphone, code, PIN, e-mail ni nom dans les paramètres : l'application et le serveur retirent ces clés, masquent les suites de 6 chiffres ou plus et les adresses e-mail, limitent à 10 paramètres de 100 caractères.
- L'utilisateur peut désactiver le suivi dans **Paramètres → Statistiques d'usage**. Plus rien n'est alors collecté ni envoyé, et la file locale est vidée.
- Conservation : 90 jours (purge automatique).
- À faire côté juridique : mentionner ce suivi dans la politique de confidentialité et les CGU.

## Ajouter un évènement

1. Ajouter l'évènement dans `tracking_plan.json` (module, écran, nom en `snake_case`, source `app` ou `server`, déclencheur, paramètres).
2. Émettre l'évènement :
   - **action liée à un appel serveur** : ajouter une règle dans `mobile/src/services/apiEvents.js` (verbe, chemin, nom en cas de succès, nom en cas d'échec, paramètres). Aucun écran à modifier.
   - **autre action** : `track('nom_de_l_evenement', { parametre: valeur })` (`mobile/src/services/analytics.js`).
   - **évènement serveur** : `Analytics::server('nom', $userId, ['param' => 'valeur'], $cleDeDedoublonnage)`.
3. Vérifier : `cd mobile && node tools/check-tracking.js` (un nom émis mais absent du plan serait refusé par le serveur).
4. Exporter le tableau : `node tools/export-tracking-plan.js` → `docs/plan-de-marquage-koligo.csv`.

Les écrans sont mesurés automatiquement (`screen_view`) à partir de la navigation : un nouvel écran n'a rien à déclarer.

## Lire les résultats

- **Vue d'ensemble** : appareils actifs, sessions, utilisateurs connectés, durée moyenne, erreurs par session, appareils par jour, entonnoirs, écrans les plus vus, versions, rôles, appels en échec.
- **Plan de marquage** : chaque évènement avec ce qui a été reçu sur la période ; filtre « jamais reçus » pour repérer un défaut de mesure ; export CSV.
- **Parcours** : recherche par numéro, e-mail, identifiant d'utilisateur, d'appareil ou de session. Réunit les évènements connectés, ceux de l'appareil avant la connexion et ceux du serveur, session par session, dans l'ordre exact.

Un entonnoir compte les appareils (ou les évènements, pour la course et le Boost) qui ont atteint chaque étape sur la période, sans exiger l'ordre.

## Tests

| Fichier | Contenu |
|---|---|
| `backend-php/tests/analytics_test.php` | réception, doublons, données personnelles, horloge, ordre, statistiques, entonnoirs, parcours, limites (41 contrôles) |
| `mobile/tools/check-tracking.js` | accord entre le code de l'application et le plan |
| `DB_DRIVER=sqlite DB_SQLITE_PATH=:memory: php backend-php/tests/analytics_test.php` | lancer le test serveur |
