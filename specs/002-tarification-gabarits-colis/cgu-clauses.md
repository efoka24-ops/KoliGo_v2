# Clauses CGU proposées : gabarits, frais d'annulation, remboursement

**Statut** : brouillon à valider (montants et délais entre crochets). À faire relire par un conseil juridique camerounais avant publication. Ne pas copier dans `TermsScreen.js` tant que les montants ne sont pas décidés.

Ces articles s'ajoutent aux 6 articles actuels de `mobile/src/screens/shared/TermsScreen.js`. Deux articles existants sont aussi à corriger (voir fin de fichier).

---

## Article 7 : Déclaration du colis et calcul du prix

7.1 Le vendeur choisit, au moment de la publication, la catégorie de taille (« gabarit ») qui correspond à son colis, indique sa nature et joint une photo du colis emballé.

7.2 Le prix de la livraison est calculé par KoliGo à partir de la région, de la distance, du gabarit choisi et du type de livreur. Il est affiché au vendeur avant la publication.

7.3 Le vendeur déclare des informations exactes. Le gabarit choisi doit correspondre à la taille et à l'encombrement réels du colis.

## Article 8 : Contrôle à la collecte et révision du prix

8.1 À son arrivée, avant la remise du code de collecte, le livreur vérifie que le colis correspond au gabarit déclaré.

8.2 S'il constate un écart, le livreur propose un autre gabarit en joignant une photo. Le vendeur voit le nouveau prix dans l'application.

8.3 Le vendeur dispose de **[X minutes]** pour accepter ou refuser. Passé ce délai, **[la course est annulée / le prix révisé s'applique]**.

8.4 Si le colis part sans correction, le gabarit déclaré est définitif. Le livreur ne peut plus réclamer de supplément.

8.5 En cas de désaccord, le vendeur peut contester la correction auprès du support KoliGo, qui décide au vu des photos du vendeur et du livreur.

## Article 9 : Frais d'annulation et remboursement

9.1 Si le vendeur refuse le prix révisé, la course est annulée et le vendeur doit au livreur des frais d'annulation de **[500 F CFA]** pour un trajet en ville. Ce montant est indiqué sur l'écran de publication.

9.2 Les frais d'annulation sont **[versés intégralement au livreur / répartis entre le livreur et KoliGo]**. Ils sont débités du portefeuille du vendeur ou **[réclamés sur sa prochaine publication]**.

9.3 Aucun frais n'est dû lorsque l'annulation est décidée par le livreur ou par KoliGo, ou lorsque le support juge la correction injustifiée.

9.4 Lorsque le vendeur a payé le transport d'avance (article 10) et que la course est annulée, il est remboursé du montant payé, diminué des frais d'annulation uniquement si l'annulation lui est imputable. Le remboursement est effectué sous **[X jours]** par le moyen de paiement utilisé **[ou crédité sur son portefeuille]**.

9.5 Chaque débit ou remboursement apparaît dans l'historique du vendeur avec son motif.

## Article 10 : Contrôle renforcé

10.1 Après **3 écarts confirmés en 30 jours**, le vendeur est placé en contrôle renforcé. Le poids du colis est alors pesé à la collecte et le transport est payé d'avance.

10.2 Le vendeur est informé de ce changement dans l'application. Il en sort après **[X jours]** sans écart.

10.3 Un écart annulé par le support ne compte pas.

## Article 11 : Modification des conditions

11.1 KoliGo peut modifier les présentes conditions. Les vendeurs doivent accepter la nouvelle version avant leur prochaine publication.

11.2 KoliGo conserve la version acceptée et la date d'acceptation de chaque utilisateur.

---

## Corrections à faire dans les articles existants

| Article | Texte actuel | Problème | Correction proposée |
|---|---|---|---|
| 1 Service | « la livraison de colis à Douala » | Le tarif devient régional ; KoliGo opère dans plusieurs villes | « dans les villes couvertes par KoliGo » |
| 1 Service | « commission de 3 % sur chaque livraison » | Fixe un taux dans les CGU alors qu'il est configurable | Renvoyer au tarif affiché dans l'application |
| 2 Paiements | « répartition automatique … dès la confirmation de réception » | Ne couvre ni les frais d'annulation ni le prépaiement | Ajouter un renvoi vers l'article 9 |
| 4 Responsabilités | « Le vendeur est responsable du conditionnement » | N'indique pas qui répond du gabarit déclaré | Ajouter : le vendeur répond de l'exactitude du gabarit |

Mettre aussi à jour la date « Dernière mise à jour : 1ᵉʳ juin 2026 » et le numéro de version.
