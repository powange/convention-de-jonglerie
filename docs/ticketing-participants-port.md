# Port « participants » de la billetterie (contrat, non encore câblé)

> **Statut** : 🟡 **Contrat défini, implémentation différée** (volontairement).
> **Date** : 2026-06-18.
> **Fichier du contrat** : [`server/ticketing/ports/participants.contract.ts`](../server/ticketing/ports/participants.contract.ts).

## Pourquoi

L'extraction de la billetterie en layer (`layers/ticketing`) est faite pour le **cœur config**
(PR #35), **tout le front** (PR #36) et la **config portée par l'Edition** (PR #37, port `event`).
Il reste, **dans le cœur jonglerie**, les endpoints de **contrôle d'accès** qui lisent des modèles
d'**autres modules** (bénévoles, artistes, organisateurs) :

| Endpoint                                        | Modèles cross-module lus                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `search.post`                                   | EditionArtist, EditionOrganizer, EditionVolunteerApplication, ArtistMealSelection |
| `verify.post`                                   | idem + sélections repas                                                           |
| `validate-entry.post` / `invalidate-entry.post` | EditionArtist, EditionOrganizer, EditionVolunteerApplication                      |
| `recent-validations.get`                        | idem                                                                              |
| `artists-not-validated.get`                     | EditionArtist                                                                     |
| `volunteers-not-validated.get`                  | EditionVolunteerApplication                                                       |
| `organizers-not-validated.get`                  | EditionOrganizer                                                                  |
| `stats.get` / `stats/validations.get`           | EditionArtist, EditionOrganizer, EditionVolunteerApplication                      |
| `organizers/handout-items/index.post`           | EditionOrganizer                                                                  |
| `volunteers/handout-items/index.post`           | VolunteerTeam                                                                     |

Ces endpoints **fusionnent plusieurs types de personnes** (détenteurs de billets **+** bénévoles **+**
artistes **+** organisateurs) pour décider qui peut entrer. **« Qui compte comme participant à
l'entrée » est spécifique au domaine** — d'où le besoin d'un port plutôt qu'une lecture directe.

## Le contrat

Le port [`TicketingParticipantsPort`](../server/ticketing/ports/participants.contract.ts) abstrait
**uniquement les participants hors-billet** (la billetterie possède déjà ses acheteurs via
`Order`/`OrderItem`, dans le layer). Forme normalisée :

```ts
interface AccessParticipant {
  type: ParticipantType // jonglerie : 'VOLUNTEER' | 'ARTIST' | 'ORGANIZER'
  id: number
  user: ParticipantUser | null // id, pseudo, prenom, nom, email, emailHash, profilePicture
  entryValidated: boolean
  validatedAt?: Date | string | null
  validatedBy?: ParticipantUser | null
  details: Record<string, unknown> // teams (bénévole) / shows (artiste) / … — opaque, rendu par le front
}
```

Méthodes (chacune correspond à un endpoint actuel) : `listNotValidated`, `search`,
`listRecentlyValidated`, `setEntryValidated`, `setEntryInvalidated`, `getEntryStats`, `getMealAccess`.

## Pourquoi l'implémentation est différée (et non un oubli)

1. **YAGNI / abstraction prématurée** : la forme idéale du port dépend des **vrais types de
   participants** de la 2ᵉ app (a-t-elle des bénévoles ? des artistes ? d'autres types ?). Figer
   l'abstraction avant de les connaître risque de produire la mauvaise interface.
2. **Couplage front, pas seulement serveur** : le front du layer rend des composants **propres au
   type** (`VolunteerDetailsCard`, `ArtistDetailsCard`, `OrganizerDetailsCard`,
   `ParticipantDetailsModal`). Rendre le contrôle d'accès vraiment générique suppose aussi de rendre
   ce rendu **pluggable** (slot par type de participant). À concevoir avec la 2ᵉ app.
3. **Surface importante sur une feature critique** : `search` (804 lignes), `verify` (648),
   `validate-entry` (522)… ~3500 lignes sur la **validation d'entrée le jour J**. Migrer à l'aveugle
   = risque de régression non justifié tant que la 2ᵉ app n'existe pas.

## Plan de migration (quand la 2ᵉ app sera décidée)

1. **Affiner le contrat** avec les types de participants réels de la 2ᵉ app.
2. **Câbler** `TicketingParticipantsPort` dans `TicketingPorts` + binding jonglerie
   (`default-binding.ts`) lisant EditionVolunteerApplication / EditionArtist / EditionOrganizer /
   ArtistMealSelection.
3. **Migrer les endpoints par vagues** (lecture d'abord — moins risqué) :
   - vague 1 : `*-not-validated`, `recent-validations`, `stats`, `stats/validations`
   - vague 2 : `search`, `verify` (recherche + accès repas)
   - vague 3 : `validate-entry`, `invalidate-entry` (mutations)
   - vague 4 : `*/handout-items/index.post` (lectures VolunteerTeam / EditionOrganizer)
4. **Rendre le front pluggable** : slot de rendu par type de participant ; le binding jonglerie fournit
   les composants actuels.
5. À chaque vague : test du port + smoke SSR + `grep prisma.*` cross-module dans `layers/ticketing/server` → 0.

## Déjà fait (réduction de la surface en cœur)

- Endpoints **autonomes** déplacés dans le layer sans port : `verify-qrcode.post` (lookup QR HelloAsso),
  `stats-sse.get` (flux SSE).
- Les autres endpoints config (settings/sumup/external) sont déjà dans le layer via le port `event`
  (PR #37).

> Restent en cœur : les endpoints de contrôle d'accès cross-module listés plus haut, jusqu'à
> implémentation du port participants.
