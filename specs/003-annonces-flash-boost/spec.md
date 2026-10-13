# Cahier des charges — Annonces « Flash » et « Boost » (marketplace KoliGo)

Statut : **proposition à valider** · Rédigé le 13/10/2026 · Dépend du lot « livraison sécurisée » (lots 1 et 2, livrés).

## 1. Objectif
Permettre à un vendeur de publier une annonce de produit visible par les acheteurs de sa ville, pendant une durée choisie, et de faire livrer la vente par KoliGo avec le parcours de livraison existant.

Hors périmètre de cette première version : paiement des produits par KoliGo (l'acheteur règle le vendeur directement, comme aujourd'hui), avis sur les produits, panier multi-produits.

## 2. Acteurs
| Acteur | Droits |
|---|---|
| Vendeur (KYC validé, compte non suspendu) | publie, modifie, retire, « rebooste » ses annonces |
| Acheteur | consulte le fil, recherche, contacte le vendeur, commande une livraison |
| Administrateur | modère, retire une annonce, règle les tarifs Boost, consulte les statistiques |

Un même utilisateur peut être vendeur et acheteur. Un vendeur **suspendu** (règle des incidents) ne peut plus publier d'annonce ; ses annonces actives sont masquées.

## 3. Parcours du vendeur
1. **Publier une annonce** : photos (1 à 5, la première est la couverture), titre, description, catégorie, prix en FCFA, ville, quartier, stock facultatif, mode de contact (messagerie KoliGo ou appel).
2. **Choisir la visibilité** (tarifs modifiables au back-office) :

| Option | Durée | Prix (valeurs de départ) |
|---|---:|---:|
| Flash | 24 h | gratuit |
| Boost | 3 jours | 500 F |
| Boost | 7 jours | 1 000 F |
| Boost | 15 jours | 2 000 F |
| Boost | 30 jours | 3 000 F |

3. **Flash** : l'annonce est active dès la publication.
   **Boost** : l'annonce est créée en `BROUILLON`, le vendeur paie par Mobile Money, et elle passe `ACTIVE` **uniquement à la confirmation du paiement par le fournisseur** (webhook), jamais sur une simple redirection. Paiement échoué ou abandonné : l'annonce reste en brouillon, rien n'est facturé.
4. **Pendant la visibilité** : compte à rebours, compteur de vues et de contacts, bouton « Retirer ».
5. **À l'expiration** : l'annonce passe `EXPIREE`, disparaît du fil, le vendeur est notifié et propose « Republier 24 h gratuit » ou « Booster ». L'annonce est conservée pour l'historique.

Le paiement du Boost est **indépendant du paiement du transport** : il est réglé à la publication, avant la mise en ligne ; le transport reste payé par le destinataire à la livraison.

## 4. Parcours de l'acheteur
1. **Fil d'accueil** : barre de « stories » des annonces Flash, puis liste des annonces actives de sa ville (les Boost d'abord, puis les plus récentes).
2. **Recherche et filtres** : texte, catégorie, fourchette de prix, ville, quartier.
3. **Fiche annonce** : photos, prix, localisation, nom du vendeur et note, temps restant, boutons « Contacter » et « Commander une livraison ».
4. **Contacter** : discussion rattachée à l'annonce, soumise à la même modération que les discussions de livraison (mots surveillés, vue administrateur).
5. **Commander une livraison** : crée une livraison pré-remplie (départ = quartier de l'annonce, gabarit proposé par le vendeur, valeur déclarée = prix). Le parcours de livraison existant prend le relais.

## 5. Règle d'expiration (point de vigilance)
Une annonce expirée ne doit **jamais** rester visible parce qu'une tâche de nettoyage n'a pas tourné. Toute requête publique filtre sur `expiresAt > maintenant` ET `statut = ACTIVE`. Une tâche planifiée (toutes les heures) ne fait que passer les statuts à `EXPIREE` et envoyer les notifications. Hébergement actuel : pas de cron garanti ; à défaut, le nettoyage s'exécute à l'ouverture du fil (au plus une fois par 10 minutes).

## 6. Données
- `Annonce` : id, vendeurId, titre, description, catégorie, prixXAF, ville, quartier, stock, contact, type (`FLASH`/`BOOST`), dureeHeures, `creeeLe`, `expireLe`, statut, vues, contacts, motifRetrait.
- `AnnoncePhoto` : id, annonceId, chemin, ordre.
- `AnnoncePaiement` : id, annonceId, montantXAF, référence fournisseur, statut (`EN_ATTENTE`, `REUSSI`, `ECHEC`), dates.
- `BoostTarif` (ou réglage JSON) : durée, prix, actif — modifiable au back-office.
- Statuts d'annonce : `BROUILLON`, `ACTIVE`, `EXPIREE`, `SUSPENDUE` (modération), `SUPPRIMEE`.

## 7. Modération et sécurité
- Même liste de mots surveillés que les discussions (drogues, armes, faux documents…), appliquée au titre et à la description à la publication ; une annonce qui correspond est **bloquée** ou mise `SUSPENDUE` en attente d'examen (à choisir).
- Signalement d'une annonce par n'importe quel utilisateur ; page « Annonces signalées » au back-office.
- Photos : mêmes contrôles de format et de taille que les photos de colis.
- Limites anti-spam : nombre d'annonces Flash gratuites par vendeur et par jour (proposition : 3), annonces actives simultanées plafonnées.
- Vendeur sans KYC validé : ne publie pas (comme pour la livraison).

## 8. Back-office
- Page « Annonces » : liste, filtres (statut, ville, type), retrait avec motif, historique.
- Page « Annonces signalées ».
- Réglage des tarifs Boost et des limites.
- Statistiques : annonces actives, revenus Boost, taux de republication.

## 9. Notifications
Annonce publiée, paiement Boost confirmé ou échoué, annonce bientôt expirée (≈ 2 h avant), annonce expirée, annonce retirée par KoliGo (avec motif), nouveau contact reçu.

## 10. CGU à ajouter
Contenus interdits dans les annonces, responsabilité du vendeur sur l'exactitude de l'annonce, absence de remboursement d'un Boost (sauf annonce retirée par KoliGo sans faute du vendeur — à décider), droit de retrait par KoliGo, lien avec la règle de suspension.

## 11. Écrans mobiles
Accueil acheteur (stories + fil), recherche et filtres, fiche annonce, publier une annonce (formulaire + choix de durée + paiement), mes annonces (actives, expirées, brouillons), discussion d'annonce, commander une livraison (pré-remplie).

## 12. Découpage proposé
- **A — Annonces gratuites (Flash)** : tables, publication, fil, expiration à l'affichage, fiche, contact, modération de base. Aucun paiement.
- **B — Boost payant** : paiement Mobile Money, activation sur confirmation, tarifs modifiables, rebooster.
- **C — Finitions** : stories, statistiques, signalements, limites anti-spam, commande de livraison depuis l'annonce.

## 13. Décisions à prendre avant de coder
1. L'acheteur doit-il avoir un compte pour **voir** les annonces, ou seulement pour contacter et commander ?
2. Un Boost est-il **remboursable** si l'annonce est retirée par KoliGo ?
3. Annonce qui contient un mot surveillé : **blocage immédiat** ou mise en attente d'examen ?
4. Limite d'annonces Flash gratuites par jour et par vendeur ?
5. Fournisseur de paiement du Boost : Sungku (déjà intégré) ou Easy Transact (en cours d'analyse) ?
6. La messagerie d'annonce est-elle ouverte à tout acheteur, ou réservée aux acheteurs vérifiés ?
