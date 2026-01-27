# Système d'appel à spectacles

## Vue d'ensemble

Le système d'appel à spectacles permet aux organisateurs d'éditions de publier des appels à candidatures pour les artistes souhaitant se produire lors de la convention.

## Concepts clés

### EditionShowCall

Configuration d'un appel à spectacles sur une édition. Une édition peut avoir plusieurs appels (ex: "Spectacles de scène", "Renegade", "Open Stage").

### ShowApplication

Candidature d'un artiste avec sa proposition de spectacle.

## Architecture

### Modèles Prisma

```prisma
model EditionShowCall {
  id                    Int       @id @default(autoincrement())
  editionId             Int
  name                  String    // Nom de l'appel
  isOpen                Boolean   @default(false)
  mode                  ShowCallMode @default(INTERNAL)
  externalUrl           String?
  description           String?   @db.Text
  deadline              DateTime?
  // Champs demandés (configurables)
  askPortfolioUrl       Boolean   @default(true)
  askVideoUrl           Boolean   @default(true)
  askTechnicalNeeds     Boolean   @default(true)
  askAccommodation      Boolean   @default(false)
  askDepartureCity      Boolean   @default(false)  // Ville de départ pour calcul défraiement

  edition               Edition   @relation(fields: [editionId], references: [id])
  applications          ShowApplication[]
}

model ShowApplication {
  id                    Int       @id @default(autoincrement())
  showCallId            Int
  userId                Int
  status                ShowApplicationStatus @default(PENDING)

  // Infos artiste
  artistName            String
  artistBio             String?   @db.Text
  portfolioUrl          String?
  videoUrl              String?

  // Infos spectacle proposé
  showTitle             String
  showDescription       String    @db.Text
  showDuration          Int       // en minutes (max 180)
  showCategory          String?
  technicalNeeds        String?   @db.Text

  // Personnes supplémentaires dans le spectacle
  additionalPerformersCount Int   @default(0)       // Nombre de personnes en plus de l'artiste principal
  additionalPerformers  Json?                       // Tableau JSON [{lastName, firstName, email, phone}]

  // Logistique
  accommodationNeeded   Boolean   @default(false)
  accommodationNotes    String?   @db.Text
  departureCity         String?                     // Ville de départ pour défraiement

  // Gestion
  organizerNotes        String?   @db.Text
  decidedAt             DateTime?
  decidedById           Int?
}
```

### Types TypeScript

Les types sont centralisés dans `app/types/index.d.ts` :

- `EditionShowCall` - Configuration complète d'un appel
- `EditionShowCallWithStats` - Appel avec statistiques de candidatures
- `EditionShowCallBasic` - Version simplifiée pour les listes
- `EditionShowCallPublic` - Version publique avec champs de configuration
- `ShowApplication` - Candidature complète
- `ShowApplicationWithShowCallName` - Candidature avec nom de l'appel
- `ShowCallStats` - Statistiques (pending, accepted, rejected, total)

## API Endpoints

### Gestion (organisateurs)

| Endpoint                                                                  | Méthode | Description            | Permission       |
| ------------------------------------------------------------------------- | ------- | ---------------------- | ---------------- |
| `/api/editions/[id]/shows-call`                                           | GET     | Liste des appels       | canManageArtists |
| `/api/editions/[id]/shows-call`                                           | POST    | Créer un appel         | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]`                              | GET     | Détails d'un appel     | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]`                              | PUT     | Modifier un appel      | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]`                              | DELETE  | Supprimer un appel     | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]/applications`                 | GET     | Liste des candidatures | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]/applications/[applicationId]` | GET     | Détails candidature    | canManageArtists |
| `/api/editions/[id]/shows-call/[showCallId]/applications/[applicationId]` | PATCH   | Modifier statut        | canManageArtists |

### Public (artistes)

| Endpoint                                                    | Méthode | Description                        | Permission             |
| ----------------------------------------------------------- | ------- | ---------------------------------- | ---------------------- |
| `/api/editions/[id]/shows-call/public`                      | GET     | Liste publique des appels          | Public                 |
| `/api/editions/[id]/shows-call/[showCallId]/public`         | GET     | Détails public d'un appel          | Public                 |
| `/api/editions/[id]/shows-call/[showCallId]/applications`   | POST    | Soumettre candidature              | Authentifié + isArtist |
| `/api/editions/[id]/shows-call/[showCallId]/my-application` | GET     | Ma candidature                     | Authentifié            |
| `/api/editions/[id]/shows-call/[showCallId]/my-application` | PUT     | Modifier ma candidature            | Authentifié            |
| `/api/editions/[id]/shows-call/my-applications`             | GET     | Toutes mes candidatures (optimisé) | Authentifié            |

## Permissions

### canManageArtists

Un utilisateur peut gérer les appels à spectacles s'il :

- Est le créateur de l'édition
- Est l'auteur de la convention parente
- Est organisateur avec le droit `canManageArtists`
- Est admin global

### Candidature

Pour soumettre une candidature, l'utilisateur doit :

- Être authentifié
- Avoir la catégorie `isArtist` activée dans son profil
- L'appel doit être ouvert (`isOpen: true`)
- L'appel doit être en mode `INTERNAL` (pas externe)
- La date limite ne doit pas être dépassée
- Ne pas avoir déjà candidaté à cet appel

## Workflow

### Création d'un appel (organisateur)

1. Aller sur `/editions/[id]/gestion/shows-call`
2. Cliquer sur "Créer un appel"
3. Renseigner le nom et la description
4. Configurer les options (mode, deadline, champs demandés)
5. Ouvrir l'appel quand prêt

### Candidature (artiste)

1. Aller sur `/editions/[id]/shows-call`
2. Voir les appels ouverts
3. Cliquer sur "Candidater"
4. Remplir le formulaire
5. Soumettre

### Modification de candidature (artiste)

L'artiste peut modifier sa candidature tant que :

- Le statut est `PENDING` (en attente)
- L'appel est toujours ouvert (`isOpen: true`)
- La date limite n'est pas dépassée

1. Aller sur `/editions/[id]/shows-call`
2. Voir la section "Mes candidatures"
3. Cliquer sur "Modifier" sur une candidature en attente
4. Le formulaire s'ouvre en mode édition avec les données pré-remplies
5. Modifier les informations souhaitées
6. Soumettre les modifications

**Note** : Une candidature acceptée ou rejetée ne peut plus être modifiée.

### Traitement des candidatures (organisateur)

1. Aller sur `/editions/[id]/gestion/shows-call/[showCallId]/applications`
2. Filtrer par statut si besoin
3. Voir les détails de chaque candidature
4. Accepter ou rejeter avec notes

## Pages Frontend

### Gestion (layout: edition-dashboard)

- `/editions/[id]/gestion/shows-call` - Liste des appels
- `/editions/[id]/gestion/shows-call/[showCallId]` - Configuration d'un appel
- `/editions/[id]/gestion/shows-call/[showCallId]/applications` - Gestion des candidatures

### Public

- `/editions/[id]/shows-call` - Liste publique des appels + mes candidatures
- `/editions/[id]/shows-call/[showCallId]/apply` - Formulaire de candidature

## Traductions i18n

Les traductions sont organisées par fichier dans `i18n/locales/fr/` :

- `gestion.json` → `shows_call.*` - Interface de gestion
- `public.json` → `shows_call.*` - Interface publique

**Note** : Le nom du fichier de langue ne fait pas partie de la clé. Utiliser `t('shows_call.title')` et non `t('public.shows_call.title')`.

## Tests

Les tests unitaires sont dans :

- `test/nuxt/server/api/editions/shows-call/applications.post.test.ts` - Soumission de candidature
- `test/nuxt/server/api/editions/shows-call/index.get.test.ts` - Liste des appels
- `test/nuxt/server/api/editions/shows-call/my-application.get.test.ts` - Récupération de ma candidature
- `test/nuxt/server/api/editions/shows-call/my-application.put.test.ts` - Modification de candidature

## Personnes supplémentaires

Le système permet à l'artiste principal de déclarer des participants supplémentaires au spectacle.

### Structure des données

```typescript
// Champ additionalPerformers (JSON)
interface AdditionalPerformer {
  lastName: string // Nom de famille (obligatoire)
  firstName: string // Prénom (obligatoire)
  email: string // Email (obligatoire, format validé)
  phone: string // Téléphone (obligatoire)
}

// Le champ additionalPerformersCount doit correspondre au nombre d'éléments
// dans le tableau additionalPerformers
```

### Validation

- `additionalPerformersCount` doit être égal à la longueur du tableau `additionalPerformers`
- Chaque participant doit avoir tous les champs obligatoires remplis
- L'email doit être un format valide
- Le schéma de validation est défini dans `server/utils/validation-schemas.ts`

### Utilisation

1. L'artiste indique le nombre de personnes supplémentaires
2. Un formulaire dynamique affiche autant de blocs que de personnes déclarées
3. Chaque bloc demande : nom, prénom, email, téléphone
4. Ces informations sont stockées en JSON dans la candidature

## Sécurité

- Vérification `isArtist` avant toute candidature
- Validation des données avec Zod (`showApplicationSchema`)
- Permissions vérifiées à chaque endpoint
- Protection contre les candidatures multiples (unicité `showCallId_userId`)
