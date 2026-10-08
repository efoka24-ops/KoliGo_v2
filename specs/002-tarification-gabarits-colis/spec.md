# Feature Specification: Tarification par gabarits et vérification du colis

**Feature Branch**: `002-tarification-gabarits-colis` (branche non créée, voir notes)

**Created**: 2026-10-08

**Status**: Implémentée (serveur, application mobile, back-office) — validation HTTP de bout en bout à faire

**Input**: Note « KoliGo : tarification par zones et vérification du colis » (7 oct. 2026, @ESPRIT) + demande d'inscrire les frais d'annulation et de remboursement des vendeurs dans les CGU.

**Périmètre** : phases A et B de la note (gabarits, photo, tarif régional en ville, contrôle à la collecte, frais d'annulation, CGU). L'interurbain, la suggestion de gabarit par IA et la mesure en réalité augmentée sont **hors périmètre** (voir Assumptions).

## Clarifications

### Session 2026-10-08

- Q: Frais d'annulation → A: 500 F en ville, versés à 100 % au livreur, montant réglable dans le back-office.
- Q: Vendeur qui ne répond pas à une correction → A: délai de 10 min (réglable), puis annulation sans frais.
- Q: Gabarit XXL → A: publication bloquée, renvoi vers le support.
- Q: Annulation par le vendeur → A: gratuite avant acceptation et 2 min (réglable) après ; ensuite 500 F.
- Q: Remboursement d'une course prépayée → A: crédit immédiat sur le portefeuille (le prépaiement lui-même n'est pas encore développé).
- Q: Tarifs → A: valeurs du PDF par défaut, **modifiables depuis le back-office** (zones, gabarits, frais, délais) ; le détail du prix d'une livraison déjà créée reste conservé pour que ses factures ne changent pas.
- Q: CGU → A: **stockées en base et éditées depuis le back-office** (jamais en dur dans l'app) ; chaque publication crée une version à ré-accepter ; version et date d'acceptation enregistrées.
- Q: Livrer ses propres colis → A: interdit ; les offres du vendeur sont masquées dans sa liste.
- Q: Filtre des offres → A: filtre facultatif par ville ou quartier de collecte ; sans filtre, toutes les offres sont visibles.
- Q: KYC → A: **un seul dossier par personne, valable pour les deux rôles**, obligatoire après la création du compte ; sans validation par le back-office, ni publication (Vendeur) ni livraison (Livreur).
- Q: Reçus → A: le reçu de l'étape en cours s'enregistre comme image PNG ou JPG dans la galerie du téléphone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Le vendeur déclare son colis par gabarit (Priority: P1)

Le vendeur ne saisit plus de poids. Il choisit un gabarit illustré par des objets du quotidien, indique la nature du colis, joint une photo du colis emballé, et voit le prix calculé par KoliGo. Les frais qui s'appliqueraient en cas d'écart constaté à la collecte sont affichés **avant** la publication.

**Why this priority**: c'est la correction du problème de départ (poids déclaré non vérifié, prix trop bas). Sans elle, rien d'autre n'a de base.

**Independent Test**: publier une livraison avec chaque gabarit et vérifier que le prix affiché correspond à la grille, que la photo et la catégorie sont exigées, et que la mention des frais est visible avant de valider.

**Acceptance Scenarios**:

1. **Given** un vendeur sur l'écran de publication, **When** il n'a pas choisi de gabarit, **Then** il ne peut pas publier.
2. **Given** un gabarit choisi, **When** aucune photo n'est jointe, **Then** la publication est refusée avec un message clair.
3. **Given** la catégorie « électroménager » et le gabarit XS, **When** le vendeur valide, **Then** une alerte d'incohérence lui demande de confirmer ou de corriger.
4. **Given** le gabarit XXL, **When** le vendeur le choisit, **Then** il est orienté selon la décision FR-013.
5. **Given** un prix affiché, **When** le vendeur publie, **Then** le prix enregistré est celui calculé par KoliGo et le détail du calcul est conservé tel qu'il était à cet instant.

---

### User Story 2 - Le livreur contrôle le colis à la collecte (Priority: P1)

À la porte du vendeur, avant la saisie du code de collecte, le livreur indique si le colis est conforme au gabarit déclaré. S'il ne l'est pas, il propose un autre gabarit avec une photo. Le vendeur voit le nouveau prix et accepte ou annule.

**Why this priority**: c'est le seul contrôle réel. Il protège les livreurs et les vendeurs honnêtes.

**Independent Test**: simuler une collecte conforme, une collecte corrigée acceptée, une collecte corrigée refusée, et une collecte corrigée sans réponse du vendeur.

**Acceptance Scenarios**:

1. **Given** un colis conforme, **When** le livreur confirme, **Then** le code de collecte peut être saisi et le prix ne change pas.
2. **Given** un colis non conforme, **When** le livreur propose un gabarit sans joindre de photo, **Then** la correction est refusée.
3. **Given** une correction avec photo, **When** le vendeur accepte, **Then** le prix est recalculé, la commission suit, et la collecte peut se poursuivre.
4. **Given** une correction avec photo, **When** le vendeur refuse, **Then** la course est annulée et les frais d'annulation sont dus conformément aux CGU.
5. **Given** une correction envoyée, **When** le vendeur ne répond pas dans le délai (FR-016), **Then** le résultat est celui défini par FR-016.
6. **Given** un colis parti sans correction, **When** le livreur réclame un supplément, **Then** la demande est refusée : le gabarit déclaré est définitif.

---

### User Story 3 - Les CGU informent les vendeurs des frais (Priority: P1)

Les CGU décrivent clairement : le calcul du prix par gabarit, le droit du livreur de corriger le gabarit, les frais d'annulation à la charge du vendeur, les règles de remboursement et le contrôle renforcé. Les vendeurs déjà inscrits doivent accepter la nouvelle version avant leur prochaine publication, et KoliGo conserve la preuve de cette acceptation.

**Why this priority**: sans acceptation préalable et prouvable, KoliGo ne peut pas débiter des frais d'annulation sans risque de contestation. Cette histoire est donc bloquante pour la mise en production des frais.

**Independent Test**: un vendeur inscrit avant la mise à jour tente de publier : il est bloqué jusqu'à l'acceptation. Après acceptation, la version et la date sont consultables par le support.

**Acceptance Scenarios**:

1. **Given** un vendeur ayant accepté une ancienne version des CGU, **When** il ouvre l'écran de publication après la mise à jour, **Then** il doit lire et accepter la nouvelle version.
2. **Given** une acceptation, **When** le support consulte le dossier du vendeur, **Then** il voit la version acceptée et la date.
3. **Given** l'écran de publication, **When** le vendeur choisit un gabarit, **Then** le montant des frais d'annulation et un lien vers l'article des CGU sont visibles sans action supplémentaire.
4. **Given** un utilisateur qui lit les CGU, **When** il change de langue, **Then** les clauses sur les frais existent en français et en anglais, avec le même sens.

---

### User Story 4 - L'administrateur règle les tarifs par région (Priority: P2)

L'administrateur définit, par zone tarifaire, la prise en charge et le prix au kilomètre, ainsi que les poids de référence des gabarits, sans intervention technique. Un changement n'affecte que les livraisons créées après lui.

**Why this priority**: le tarif régional doit se tester sur Garoua et Douala pendant un mois. Il faut pouvoir le régler sans redéploiement.

**Independent Test**: modifier le prix au kilomètre d'une zone, créer une livraison, vérifier le nouveau prix ; consulter une facture ancienne et vérifier qu'elle n'a pas changé.

**Acceptance Scenarios**:

1. **Given** une ville rattachée à une région, **When** une livraison est créée, **Then** les paramètres de sa zone tarifaire sont appliqués.
2. **Given** une modification de tarif, **When** une facture antérieure est consultée, **Then** son détail et son total sont inchangés.
3. **Given** une région absente de toute zone, **When** une livraison y est créée, **Then** un tarif de repli défini est appliqué et l'anomalie est signalée à l'administrateur.

---

### User Story 5 - Contrôle renforcé et remboursement des vendeurs à écarts répétés (Priority: P3)

Après 3 écarts confirmés en 30 jours, le vendeur passe en contrôle renforcé : pesée obligatoire et paiement du transport à l'avance. Si une course payée d'avance est annulée, le vendeur est remboursé du montant payé moins les frais d'annulation dus.

**Why this priority**: c'est le correctif pour les récidivistes, mais il n'a de sens qu'une fois les histoires 1 à 3 en place.

**Independent Test**: enregistrer 3 écarts confirmés en 30 jours et vérifier le changement de statut, puis annuler une course prépayée et vérifier le remboursement.

**Acceptance Scenarios**:

1. **Given** deux écarts confirmés, **When** un troisième est confirmé dans les 30 jours, **Then** le vendeur passe en contrôle renforcé et en est informé.
2. **Given** un vendeur en contrôle renforcé, **When** il publie, **Then** le paiement anticipé est exigé.
3. **Given** une course prépayée annulée par refus de correction, **When** l'annulation est confirmée, **Then** le vendeur reçoit le remboursement net et un récapitulatif lisible.
4. **Given** une course prépayée annulée par le livreur ou par KoliGo, **When** l'annulation est confirmée, **Then** le vendeur est remboursé intégralement, sans frais.

---

### User Story 6 - Le support tranche un litige de gabarit (Priority: P3)

Quand le vendeur conteste une correction, le support voit les deux photos (vendeur et livreur), l'historique et décide. Les écarts jugés abusifs comptent contre le livreur, pas contre le vendeur.

**Why this priority**: sans arbitrage, les livreurs peuvent gonfler les gabarits et les vendeurs honnêtes sont pénalisés.

**Independent Test**: ouvrir une contestation et vérifier que les deux photos, les gabarits et les prix sont visibles, puis trancher dans chaque sens et vérifier le score et les frais.

**Acceptance Scenarios**:

1. **Given** une contestation, **When** le support l'ouvre, **Then** il voit photo du vendeur, photo du livreur, gabarit déclaré, gabarit proposé et prix.
2. **Given** une décision en faveur du vendeur, **When** elle est validée, **Then** les frais d'annulation sont annulés ou remboursés et l'écart n'est pas compté contre lui.

---

### Edge Cases

- Le vendeur ou le destinataire est injoignable pendant la révision du prix.
- Le livreur arrive avec un véhicule inadapté au gabarit déclaré.
- Le gabarit déclaré est plus grand que la réalité : aucun supplément n'est dû au livreur et aucun remboursement automatique n'est prévu au vendeur (à confirmer).
- Une livraison créée avec l'ancien formulaire (poids saisi, sans gabarit) existe encore au moment de la mise à jour.
- Le tarif change entre la publication et l'acceptation par le livreur.
- Un vendeur publie hors connexion ou avec une version ancienne de l'application.
- Le vendeur annule lui-même avant l'arrivée du livreur : frais ou non ?
- Un écart est contesté après le délai de 30 jours du score.
- Le paiement du destinataire est déjà en cours quand le prix est révisé.
- Le téléphone n'a pas de photo disponible (caméra en panne, stockage plein).

## Requirements *(mandatory)*

### Functional Requirements

**Déclaration du colis**

- **FR-001**: Le système MUST remplacer la saisie libre du poids par le choix d'un gabarit parmi XS, S, M, L, XL, XXL, chacun avec dimensions maximales, poids maximal et poids de référence.
- **FR-002**: Le système MUST exiger la nature du colis et signaler toute combinaison incompatible avec le gabarit.
- **FR-003**: Le système MUST exiger au moins une photo du colis emballé pour publier.
- **FR-004**: Le système MUST montrer, pour chaque gabarit, des exemples d'objets du quotidien.

**Prix**

- **FR-005**: Le prix MUST être calculé uniquement par le serveur à partir de la zone tarifaire de la ville, de la distance, du poids de référence du gabarit et du coefficient du type de livreur.
- **FR-006**: Le prix affiché au vendeur avant publication MUST provenir du même calcul que le prix enregistré, sans seconde formule côté application.
- **FR-007**: Le détail du calcul (zone, prise en charge, prix au km, poids de référence, coefficient, commission) MUST être conservé à la création de la livraison et réutilisé tel quel pour les factures.
- **FR-008**: Un changement de tarif MUST NOT modifier les livraisons ni les factures déjà créées.
- **FR-009**: L'administrateur MUST pouvoir régler la prise en charge, le prix au km, les poids de référence et les gabarits sans nouveau déploiement.

**Contrôle à la collecte**

- **FR-010**: Avant la saisie du code de collecte, le livreur MUST confirmer la conformité ou proposer un autre gabarit.
- **FR-011**: Une correction de gabarit MUST être accompagnée d'au moins une photo du livreur.
- **FR-012**: Après une correction, le système MUST bloquer la collecte jusqu'à la réponse du vendeur et lui montrer le nouveau prix.
- **FR-013**: Pour le gabarit XXL (« sur devis »), le système MUST bloquer la publication et orienter vers le support.
- **FR-014**: Une fois le colis parti sans correction, le gabarit déclaré MUST être définitif et aucun supplément ne peut être réclamé.
- **FR-015**: Le système MUST empêcher un livreur dont le véhicule est inadapté au gabarit d'accepter la livraison.
- **FR-016**: Si le vendeur ne répond pas à une correction dans le délai réglé (10 min par défaut), le système MUST annuler la course sans frais pour le vendeur.

**Frais, remboursement et CGU**

- **FR-017**: Si le vendeur refuse un nouveau prix, la course MUST être annulée et des frais d'annulation, d'un montant fixé par la plateforme, MUST être dus au livreur.
- **FR-018**: Le montant des frais d'annulation MUST être visible par le vendeur avant la publication, avec un lien vers l'article des CGU.
- **FR-019**: Une course prépayée annulée MUST donner lieu à un remboursement du montant payé, diminué des frais d'annulation uniquement lorsque l'annulation est imputable au vendeur ; sinon le remboursement est intégral.
- **FR-020**: Le montant des frais d'annulation (500 F par défaut) MUST être réglable depuis le back-office et versé à 100 % au livreur ; si le solde du vendeur ne suffit pas, le solde passe à zéro et le reste est retenu sur ses prochains gains.
- **FR-021**: Le système MUST conserver, pour chaque utilisateur, la version des CGU acceptée et la date d'acceptation, consultables par le support.
- **FR-022**: Une nouvelle version des CGU modifiant les frais MUST être acceptée par les vendeurs existants avant leur prochaine publication.
- **FR-023**: Les CGU MUST être disponibles en français et en anglais avec des clauses équivalentes sur les frais.
- **FR-024**: Chaque débit ou remboursement lié à un écart MUST apparaître dans l'historique du vendeur avec le motif.

**Score et contrôle**

- **FR-025**: Le système MUST compter les écarts confirmés par vendeur sur 30 jours glissants et passer le vendeur en contrôle renforcé au troisième.
- **FR-026**: Un vendeur en contrôle renforcé MUST payer le transport d'avance.
- **FR-027**: Le support MUST pouvoir consulter les deux photos et trancher une contestation, et sa décision MUST corriger score et frais.
- **FR-028**: Les contestations MUST alimenter un indicateur de gonflement des gabarits par livreur.

**Données existantes**

- **FR-029**: Les livraisons créées avant la mise à jour MUST rester consultables et facturables sans gabarit.

**Comptes, offres et reçus**

- **FR-030**: Un même compte MUST pouvoir être Vendeur et Livreur ; il ne MUST NOT pouvoir accepter une livraison qu'il a publiée.
- **FR-031**: Le livreur MUST pouvoir filtrer les offres par ville ou quartier de collecte ; sans filtre, aucune barrière géographique.
- **FR-032**: Les offres MUST être paginées (20 par page) et ne MUST NOT exposer les codes ni le jeton de suivi avant l'acceptation.
- **FR-033**: Le KYC MUST être demandé après la création du compte, être un dossier unique valable pour les deux rôles, et ne se soumettre qu'une fois.
- **FR-034**: Sans KYC validé par le back-office, le serveur MUST refuser la publication (Vendeur) et l'acceptation (Livreur).
- **FR-035**: L'administrateur MUST pouvoir modifier zones, gabarits, frais, délais et le texte des CGU sans déploiement.
- **FR-036**: L'utilisateur MUST pouvoir enregistrer le reçu de son étape en image PNG ou JPG dans la galerie de son téléphone.

### Key Entities

- **Gabarit** : taille de colis avec dimensions maximales, poids maximal, poids de référence, véhicule minimal, exemples.
- **Zone tarifaire** : regroupe des régions ; porte la prise en charge et le prix au km.
- **Déclaration de colis** : gabarit, catégorie, photos du vendeur, rattachée à une livraison.
- **Révision de gabarit** : proposition du livreur (gabarit, photos), ancien et nouveau prix, réponse du vendeur, date limite, issue.
- **Détail de prix figé** : les paramètres et montants appliqués à une livraison au moment de sa création ou de sa révision.
- **Frais d'annulation** : montant, motif, redevable, bénéficiaire, statut.
- **Acceptation des CGU** : utilisateur, version, date, langue.
- **Écart vendeur** : livraison, date, issue (confirmé, annulé par le support).
- **Contestation** : parties, photos, décision du support.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des nouvelles livraisons portent un gabarit, une catégorie et une photo.
- **SC-002**: Le prix affiché avant publication est identique au prix enregistré dans 100 % des cas.
- **SC-003**: Les factures émises avant un changement de tarif restent identiques après le changement (0 écart sur un échantillon de contrôle).
- **SC-004**: Un vendeur publie une livraison en moins de 2 minutes avec photo.
- **SC-005**: Une correction de gabarit est traitée (acceptée ou refusée) en moins de 3 minutes dans 90 % des cas.
- **SC-006**: Le nombre de livraisons collectées avec un prix revu à la hausse après le départ tombe à zéro.
- **SC-007**: 100 % des vendeurs actifs ont accepté la nouvelle version des CGU avant leur première publication après la mise à jour.
- **SC-008**: Au moins 90 % des vendeurs interrogés comprennent les frais d'annulation avant de publier.
- **SC-009**: Les litiges liés au poids ou à la taille baissent d'au moins 50 % en trois mois par rapport au trimestre précédent.
- **SC-010**: Le revenu moyen par course des livreurs du Grand Nord ne baisse pas de plus de 10 % pendant le mois de test (seuil à valider).

## Assumptions

- Les valeurs de la note (prises en charge, prix au km, poids de référence, frais de 500 F) sont des **valeurs par défaut réglables**, non validées.
- Le périmètre se limite aux livraisons en ville. L'interurbain, le poids volumétrique, la suggestion de gabarit par IA et la mesure en réalité augmentée suivent plus tard.
- Le gabarit XL est facturé sur son poids de référence en ville ; la règle volumétrique pour l'interurbain sera définie avec cette phase.
- Le prix est encaissé auprès du destinataire à la livraison : une révision avant le départ n'implique pas de remboursement, sauf pour les vendeurs en contrôle renforcé qui paient d'avance.
- Le portefeuille du vendeur peut être débité des frais d'annulation (à vérifier : la plateforme ne débite pas encore le vendeur).
- Les CGU actuelles (version du 1ᵉʳ juin 2026) sont affichées uniquement dans l'application mobile et ne mentionnent ni gabarit, ni photo, ni frais d'annulation.
- Aucune trace d'acceptation des CGU n'a été trouvée côté serveur dans le code actuel.
- Les clauses des CGU doivent être relues par un conseil juridique camerounais avant publication.
- La branche git n'a pas été créée : le dépôt contient des modifications non validées et la décision revient à l'équipe.
