# Flowvent — page publique d'un événement

Le pendant, dans Flowvent (app2), de la page d'une édition d'app1 (`/editions/:id`) : ce que
l'organisateur choisit de montrer au public.

## Ce qui existe (27/11/2026)

- **`/events/<publicId>`** se lit **sans connexion** quand l'organisateur a rendu la page publique.
  Elle montre l'affiche, le nom, les dates, le nom du lieu et l'adresse (avec un lien « Voir sur la
  carte » vers OpenStreetMap), la description, les liens (site officiel, billetterie, Facebook,
  Instagram), et une section « Participer » : devenir bénévole (si la page bénévoles est publique
  ou les candidatures ouvertes), les appels à spectacles publics ou clos, la billetterie en ligne.
- L'équipe d'organisation y voit en plus « Gérer l'événement », et un **aperçu** marqué « visible
  de l'équipe seulement » tant que la page n'est pas publique. Un aperçu n'est pas indexé.
- Un événement **annulé** (statut `CANCELLED`) l'annonce en tête de page.
- API : `GET /api/events/:id/public`, règle d'accès de `resoudreEvenement`
  (`server/utils/evenement-public.ts`) : `pagePublique` ouvre l'événement à tous, comme une page
  bénévoles publique ou un appel à spectacles en ligne. Sinon 404, l'existence ne se devine pas.

### Côté gestion (« Informations de l'événement »)

- **Lieu** : nom du lieu, adresse, complément, code postal, ville, pays.
- **Page publique** : l'interrupteur (fermée par défaut, pour qu'aucun événement en préparation ne
  s'expose seul), l'affiche, et les quatre liens (validés : `http://` ou `https://`).
- L'affiche suit le circuit de la photo de profil (`server/utils/affiche-evenement.ts`) : dépôt
  temporaire (`POST /api/files/edition`, réservé à qui peut modifier l'événement), rangée dans
  `events/<id>/` à l'enregistrement, ancienne effacée. Le domaine `events/` est public dans la route
  `/uploads`.

## Ajouté depuis

- **Contact public** (27/11) : e-mail de contact affiché sur la page.
- **Coordonnées GPS** (27/11) : calculées depuis l'adresse (Nominatim), corrigeables, et une carte
  du lieu sur la page publique.
- **FAQ** (27/11) : le layer `faq` branché ; une carte « Questions fréquentes » mène à
  `/events/<id>/faq` quand la FAQ est active, publique et a au moins une question publiée.

## Ce qui manque encore côté gestion

Par ordre d'intérêt pour la page publique.

| Manque                                    | Ce que fait app1                                                     | Dans Flowvent                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Programme**                             | onglet « Programme » : éléments de programme, spectacles, ateliers   | rien. Les spectacles existent (module artistes) mais ne sont pas publiés ; `program-items` vit dans app1 seule |
| **Carte du site publique**                | onglet « Carte », zones et repères, export KML                       | la carte existe en gestion et la colonne `mapPublic` aussi, mais ni réglage ni page publique                   |
| **Tarifs de la billetterie**              | billetterie intégrée                                                 | le layer billetterie a un endpoint public des tarifs (`tiers/public`) : il pourrait s'afficher sur la page     |
| **Services et équipements**               | ~25 cases (accessibilité PMR, camping, restauration, toilettes, CB…) | rien                                                                                                           |
| **Statut de l'événement**                 | publié, hors ligne, annulé                                           | la colonne existe, la page sait afficher « annulé », mais rien ne permet de le choisir (audit, constat G1)     |
| **Organisateurs affichés**                | liste des organisateurs sur la page                                  | rien (choix à faire : montrer l'équipe ou non)                                                                 |
| **Covoiturage, ateliers, objets trouvés** | onglets dédiés (layers `carpool`, `workshops`, `lost-found`)         | layers présents dans le dépôt, non branchés                                                                    |

Dès que deux de ces sections existent (programme, carte), la page gagnera des **onglets**, comme
celle d'une édition d'app1.

**Défaut connu** : supprimer un événement ne supprime pas son affiche du disque (fichier orphelin).
