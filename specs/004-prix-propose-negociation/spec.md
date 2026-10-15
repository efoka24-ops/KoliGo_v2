# Spécification — Prix proposés par le vendeur et négociation encadrée

Statut : **implémentée (serveur + application + back-office)** · 14/10/2026 · remplace le calcul automatique du prix comme parcours principal.

## 1. Principe
Le vendeur fixe **trois prix de livraison croissants** (ex. 1 000 / 1 200 / 1 500 F). Le livreur ne voit que le **prix courant**. S'il constate à la collecte que le colis ne correspond pas, il refuse le niveau courant, indique le **minimum qu'il demande** et la raison ; le vendeur accepte le nouveau prix ou refuse (la course est alors annulée).

L'ancien calcul (zone, distance, gabarit, trajets fixes) reste disponible : il fournit une **estimation indicative** au vendeur et le calcul des courses déjà publiées / des anciennes versions de l'application.

## 2. Règles
| Règle | Comportement |
|---|---|
| Création | 3 prix entiers, **strictement croissants**, chacun ≥ plancher (`offer_min_xaf`, 500 F par défaut) et ≤ 2 000 000 F. Une estimation indicative est affichée ; un prix très inférieur à l'estimation déclenche seulement une alerte à l'écran. |
| Visibilité livreur | Le livreur voit uniquement le **prix courant**, jamais les niveaux suivants. |
| Prix figé | Le prix courant est enregistré (avec ses frais) dès la création ; il ne change que par accord explicite du vendeur. |
| Demande du livreur | À la collecte, avant la prise en charge : motif (poids, taille, autre), **minimum demandé**, commentaire, photo (recommandée). |
| Niveau suivant | Le serveur retient le **premier niveau supérieur ≥ au minimum demandé**. |
| Épuisement | Si le minimum dépasse le niveau 3, la demande porte directement le **montant demandé** ; le vendeur l'accepte ou refuse. |
| Réponse du vendeur | Accepter : le prix, la commission, les gains du livreur et le séquestre sont mis à jour. Refuser : course annulée, **dédommagement de 500 F** (réglage `cancel_fee_xaf`) versé au livreur. |
| Délai | Le vendeur répond dans `revision_timeout_min` minutes ; sans réponse, course annulée **sans frais**. |
| Interdit / dangereux | Jamais de négociation : annulation immédiate (règle des incidents inchangée). |
| Incidents | Un motif « poids » ou « taille » ouvre un incident, confirmé quand le vendeur répond (compteur et suspension inchangés). Le motif « autre » n'en ouvre pas. |
| Historique | Chaque demande, accord, refus et expiration est enregistré et daté. |
| Courses existantes | Elles gardent leur prix et leur ancien flux. |

## 2 bis. Commission
Inchangée à **3 %** le temps de mesurer (réglage du back-office). La commission test à 1 % reste possible sans développement. Les revenus des annonces Boost sont traités dans la spécification 003.

## 3. Déplacement inutile
Si le vendeur refuse la nouvelle proposition, il dédommage le livreur (500 F par défaut, retenus sur son solde ou ses gains futurs). À inscrire dans les CGU (article 9).

## 4. Données
- `Delivery.priceBreakdown` : `mode = OFFERS`, `offers = [p1, p2, p3]`, `level`, estimation indicative.
- `PriceRequest` : livraison, type (`LEVEL` / `ASK`), motif, commentaire, photo, minimum demandé, niveaux, prix avant/après, statut, délai, dates.

## 5. API
- `POST /deliveries` : `offers: [p1, p2, p3]` (sans `offers`, ancien calcul).
- `POST /deliveries/:id/revision` : livreur, `{minPriceXAF, reason, comment, photo}` pour une course à prix proposés.
- `PATCH /deliveries/:id/revision` : vendeur, `{accept}`.
- `GET /public/quote` : estimation + `suggestedOffers`.

## 6. Hors périmètre
Contre-proposition libre du vendeur (il ne peut qu'accepter ou refuser), négociation en dehors de la collecte, retrait de l'ancien calcul du code.
