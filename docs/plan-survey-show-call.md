# Plan d'implémentation — Sondage candidatures spectacles

> Date : 27 mars 2026

## Spécification fonctionnelle

Depuis la page de gestion des candidatures d'un appel à spectacles (`/editions/{id}/gestion/shows-call/{showCallId}/applications`), l'organisateur peut générer un **lien de sondage partageable**.

### Comportement

- Tout utilisateur **connecté** disposant du lien peut voter (note de 1 à 5) sur chaque candidature **en attente**
- L'utilisateur peut **modifier son vote** tant que le sondage est ouvert
- **Sondage ouvert** → le votant voit uniquement **ses propres votes** (pas d'influence)
- **Sondage fermé** → le votant voit les **résultats globaux** (moyenne + nb votes) mais ne peut plus voter
- Les organisateurs (avec droit `canManageArtists`) peuvent :
  - Générer / régénérer le token du sondage (invalide l'ancien lien)
  - Ouvrir / fermer le sondage
  - Voir les résultats agrégés à tout moment

### Informations affichées par candidature (page sondage)

- Nom de l'artiste/compagnie, bio
- Titre du spectacle, description, durée, catégorie
- Lien portfolio, lien vidéo, liens sociaux

---

## Phase 1 — Schéma Prisma

### Fichier `prisma/schema/artists.prisma`

**Champs ajoutés sur `EditionShowCall` :**

```prisma
surveyToken String?  @unique
surveyOpen  Boolean  @default(false)
surveyVotes ShowCallSurveyVote[]
```

**Nouveau modèle :**

```prisma
model ShowCallSurveyVote {
  id            Int      @id @default(autoincrement())
  showCallId    Int
  applicationId Int
  userId        Int
  score         Int      // 1 à 5
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  showCall    EditionShowCall @relation(fields: [showCallId], references: [id], onDelete: Cascade)
  application ShowApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([showCallId, applicationId, userId])
  @@index([showCallId])
  @@index([applicationId])
  @@index([userId])
}
```

**Relation inverse sur `ShowApplication` :**

```prisma
surveyVotes ShowCallSurveyVote[]
```

**Relation sur `User` (schema.prisma) :**

```prisma
showCallSurveyVotes ShowCallSurveyVote[]
```

**Migration :** `npx prisma migrate dev --name add_show_call_survey`

---

## Phase 2 — Endpoints API organisateur

### `POST /api/editions/[id]/shows-call/[showCallId]/survey/token`

- Auth : `requireAuth` + `canManageArtists`
- Génère/régénère `surveyToken` via `generateSecureToken(16)`
- Retourne `createSuccessResponse({ surveyToken, surveyUrl })`

### `PATCH /api/editions/[id]/shows-call/[showCallId]/survey/status`

- Auth : `requireAuth` + `canManageArtists`
- Body : `{ open: boolean }` (Zod)
- Bascule `surveyOpen`
- Retourne `createSuccessResponse({ surveyOpen })`

### `GET /api/editions/[id]/shows-call/[showCallId]/survey/results`

- Auth : `requireAuth` + `canManageArtists`
- Agrège via `prisma.showCallSurveyVote.groupBy` (`_avg`, `_count`)
- Retourne `{ surveyOpen, surveyToken, results: [{ applicationId, showTitle, artistName, avgScore, voteCount }] }`

---

## Phase 3 — Endpoints API sondage (via token)

### `GET /api/survey/[token]`

- Auth : `requireAuth`
- Lookup `EditionShowCall` par `surveyToken`
- Retourne candidatures PENDING avec infos artiste/spectacle
- Inclut `myVotes: { [applicationId]: score }` (votes de l'utilisateur courant)
- Si `surveyOpen === false` : inclut aussi `results: [{ applicationId, avgScore, voteCount }]`

### `PUT /api/survey/[token]/vote`

- Auth : `requireAuth`
- Body : `{ applicationId: number, score: number }` (score 1-5, Zod)
- Vérifie `surveyOpen === true`
- Vérifie que `applicationId` appartient au showCall
- Upsert `ShowCallSurveyVote` (contrainte unique)
- Retourne `createSuccessResponse({ vote })`

---

## Phase 4 — Traductions i18n

### Fichier `i18n/locales/fr/survey.json` (nouveau domaine)

Clés nécessaires : titre, description, étoiles, sondage ouvert/fermé, voter, résultats, erreurs, etc.

Ajouter `survey` au mapping i18n dans `i18n/locales/` pour toutes les langues (fr rempli, autres en [TODO]).

---

## Phase 5 — Composants frontend

### `app/components/survey/StarRating.vue`

- Props : `modelValue: number | null`, `readonly: boolean`
- 5 étoiles cliquables (`i-heroicons-star` / `i-heroicons-star-solid`)
- État hover, emit `update:modelValue`

### `app/components/survey/ApplicationCard.vue`

- Props : `application`, `score: number | null`, `readonly: boolean`, `surveyOpen: boolean`, `result: { avgScore, voteCount } | null`
- Affiche infos artiste + spectacle + `StarRating`
- Si fermé : affiche résultats au lieu du vote

---

## Phase 6 — Page sondage

### `app/pages/survey/[token].vue`

- `definePageMeta({ middleware: ['authenticated'] })`
- Charge `GET /api/survey/{token}` au montage
- Liste les candidatures avec `ApplicationCard`
- Vote via `PUT /api/survey/{token}/vote`
- Gestion des états : loading, erreur (token invalide), sondage fermé

---

## Phase 7 — Intégration page de gestion

### Modification de `app/pages/editions/[id]/gestion/shows-call/[showCallId]/applications.vue`

Ajouter une section `UCard` "Sondage" :

- Bouton "Générer le lien" / "Régénérer" → `POST .../survey/token`
- Toggle Ouvrir/Fermer → `PATCH .../survey/status`
- Lien partageable avec bouton copier
- Tableau des résultats (moyenne + nb votes par candidature)

---

## Fichiers à créer (9)

| Fichier                                                                   | Type      |
| ------------------------------------------------------------------------- | --------- |
| `server/api/editions/[id]/shows-call/[showCallId]/survey/token.post.ts`   | API       |
| `server/api/editions/[id]/shows-call/[showCallId]/survey/status.patch.ts` | API       |
| `server/api/editions/[id]/shows-call/[showCallId]/survey/results.get.ts`  | API       |
| `server/api/survey/[token].get.ts`                                        | API       |
| `server/api/survey/[token]/vote.put.ts`                                   | API       |
| `app/pages/survey/[token].vue`                                            | Page      |
| `app/components/survey/StarRating.vue`                                    | Composant |
| `app/components/survey/ApplicationCard.vue`                               | Composant |
| `i18n/locales/fr/survey.json`                                             | i18n      |

## Fichiers à modifier (4)

| Fichier                                                                    | Modification                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prisma/schema/artists.prisma`                                             | surveyToken, surveyOpen, ShowCallSurveyVote, relation sur ShowApplication |
| `prisma/schema/schema.prisma`                                              | Relation showCallSurveyVotes sur User                                     |
| `app/pages/editions/[id]/gestion/shows-call/[showCallId]/applications.vue` | Section sondage                                                           |
| Routes publiques (`server/constants/public-routes.ts`)                     | Ajouter `/api/survey/**` si nécessaire                                    |

## Points techniques

- Token : `generateSecureToken(16)` → 32 hex chars, `@unique` en base
- Intégrité : contrainte `@@unique([showCallId, applicationId, userId])`
- Agrégation : `prisma.showCallSurveyVote.groupBy` avec `_avg` + `_count`
- Pas de route publique : `/api/survey/*` nécessite `requireAuth`
