# Helpers de sélection Prisma réutilisables

## 📋 Vue d'ensemble

Pour éviter la duplication de code et garantir la cohérence des données retournées par l'API, nous avons créé des helpers de sélection Prisma standardisés dans `server/utils/prisma-select-helpers.ts`.

## 🎯 Problème résolu

**Avant** : Les mêmes sélections étaient répétées partout dans le code

```typescript
// Dans 23+ fichiers différents
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    pseudo: true,
  },
});

// Dans d'autres fichiers
const offer = await prisma.carpoolOffer.update({
  include: {
    user: {
      select: {
        id: true,
        pseudo: true,
        profilePicture: true,
      },
    },
  },
});
```

**Après** : Utilisation de helpers réutilisables

```typescript
import {
  userBasicSelect,
  carpoolOfferInclude,
} from "#server/utils/prisma-select-helpers";

const user = await prisma.user.findUnique({
  where: { id },
  select: userBasicSelect,
});

const offer = await prisma.carpoolOffer.update({
  include: carpoolOfferInclude,
});
```

## 📊 Statistiques

- **23 occurrences** de `select: { id: true, pseudo: true }`
- **4 occurrences** de `select: { id: true, pseudo: true, profilePicture: true }`
- **15+ occurrences** de sélections utilisateur avec nom complet
- **100+ occurrences** au total de patterns répétitifs

## 🔧 Helpers disponibles

### Utilisateurs

| Helper                    | Champs                                       | Usage typique             | Occurrences |
| ------------------------- | -------------------------------------------- | ------------------------- | ----------- |
| `userBasicSelect`         | id, pseudo                                   | Listes, relations simples | ~23         |
| `userWithProfileSelect`   | id, pseudo, profilePicture                   | Avatars, covoiturage      | ~4          |
| `userWithGravatarSelect`  | id, pseudo, profilePicture, email, emailHash | Historiques, logs         | ~2          |
| `userWithNameSelect`      | id, pseudo, nom, prenom                      | Bénévoles, exports        | ~15         |
| `userPublicProfileSelect` | Profil complet public                        | Pages de profil           | Nouveau     |

### Conventions

| Helper                        | Champs              | Usage typique     |
| ----------------------------- | ------------------- | ----------------- |
| `conventionBasicSelect`       | id, name, logo      | Listes d'éditions |
| `conventionWithDetailsSelect` | + description, URLs | Pages de détail   |

### Éditions

| Helper               | Champs                   | Usage typique      |
| -------------------- | ------------------------ | ------------------ |
| `editionListSelect`  | Champs d'affichage liste | Listes, recherches |
| `editionListInclude` | + creator, convention    | Listes complètes   |

### Covoiturage

| Helper                  | Usage typique                            |
| ----------------------- | ---------------------------------------- |
| `carpoolOfferInclude`   | Offres de covoiturage avec utilisateur   |
| `carpoolRequestInclude` | Demandes de covoiturage avec utilisateur |

### Organisateurs

| Helper                     | Usage typique                    |
| -------------------------- | -------------------------------- |
| `organizerWithUserInclude` | Liste des organisateurs          |
| `organizerFullInclude`     | Historique avec détails complets |

### Bénévoles

| Helper                        | Usage typique                           |
| ----------------------------- | --------------------------------------- |
| `volunteerApplicationInclude` | Candidatures avec utilisateur           |
| `volunteerAssignmentInclude`  | Assignations avec utilisateur et équipe |

### Autres modules

| Helper                      | Usage typique                             |
| --------------------------- | ----------------------------------------- |
| `lostFoundItemInclude`      | Objets trouvés avec utilisateur           |
| `ticketingOrderInclude`     | Commandes de billetterie                  |
| `editionPostInclude`        | Posts avec auteur                         |
| `editionPostCommentInclude` | Commentaires avec auteur                  |
| `messengerMessageInclude`   | Message de messagerie (auteur + citation) |

## 📖 Guide d'utilisation

### 1. Import des helpers

```typescript
import {
  userBasicSelect,
  userWithProfileSelect,
  editionListInclude,
} from "#server/utils/prisma-select-helpers";
```

### 2. Utilisation avec `select`

```typescript
// Au lieu de
const users = await prisma.user.findMany({
  select: {
    id: true,
    pseudo: true,
  },
});

// Utiliser
const users = await prisma.user.findMany({
  select: userBasicSelect,
});
```

### 3. Utilisation avec `include`

```typescript
// Au lieu de
const offers = await prisma.carpoolOffer.findMany({
  include: {
    user: {
      select: {
        id: true,
        pseudo: true,
        profilePicture: true,
      },
    },
  },
});

// Utiliser
const offers = await prisma.carpoolOffer.findMany({
  include: carpoolOfferInclude,
});
```

### 4. Utilisation avec typage

```typescript
import type {
  UserBasic,
  EditionList,
} from "#server/utils/prisma-select-helpers";

// Le type est automatiquement inféré
const user: UserBasic = await prisma.user.findUnique({
  where: { id },
  select: userBasicSelect,
});

const editions: EditionList[] = await prisma.edition.findMany({
  select: editionListSelect,
  include: editionListInclude,
});
```

### 5. Extension des helpers

Si vous avez besoin de champs supplémentaires, utilisez le spread :

```typescript
const users = await prisma.user.findMany({
  select: {
    ...userBasicSelect,
    email: true, // Champ supplémentaire
    createdAt: true,
  },
});
```

## 🔄 Exemples de conversion

### Exemple 1 : Endpoint d'éditions

**Avant** :

```typescript
// server/api/editions/index.get.ts (ligne 312-317)
const editions = await prisma.edition.findMany({
  select: {
    // ... 40+ lignes de champs
    creator: {
      select: { id: true, pseudo: true },
    },
    convention: {
      select: { id: true, name: true, logo: true },
    },
  },
});
```

**Après** :

```typescript
import {
  editionListSelect,
  editionListInclude,
} from "#server/utils/prisma-select-helpers";

const editions = await prisma.edition.findMany({
  select: editionListSelect,
  include: editionListInclude,
});
```

**Gain** : -8 lignes, clarté du code, réutilisabilité

### Exemple 2 : Endpoint de covoiturage

**Avant** :

```typescript
// server/api/carpool-offers/[id]/index.put.ts (ligne 62-74)
const updatedOffer = await prisma.carpoolOffer.update({
  where: { id: offerId },
  data: updateData,
  include: {
    user: {
      select: {
        id: true,
        pseudo: true,
        profilePicture: true,
      },
    },
  },
});
```

**Après** :

```typescript
import { carpoolOfferInclude } from "#server/utils/prisma-select-helpers";

const updatedOffer = await prisma.carpoolOffer.update({
  where: { id: offerId },
  data: updateData,
  include: carpoolOfferInclude,
});
```

**Gain** : -7 lignes, cohérence garantie

### Exemple 3 : Endpoint d'organisateurs

**Avant** :

```typescript
// server/api/conventions/[id]/organizers.get.ts (ligne 26-28)
const organizers = await prisma.conventionOrganizer.findMany({
  include: {
    user: { select: { id: true, pseudo: true } },
    addedBy: { select: { pseudo: true } },
    perEditionPermissions: true,
  },
});
```

**Après** :

```typescript
import { organizerWithUserInclude } from "#server/utils/prisma-select-helpers";

const organizers = await prisma.conventionOrganizer.findMany({
  include: organizerWithUserInclude,
});
```

**Gain** : -3 lignes, standardisation

### Exemple 4 : Endpoint de bénévoles

**Avant** :

```typescript
// server/api/editions/[id]/volunteers/auto-assign.post.ts
const applications = await prisma.editionVolunteerApplication.findMany({
  include: {
    user: {
      select: {
        id: true,
        pseudo: true,
        nom: true,
        prenom: true,
      },
    },
  },
});
```

**Après** :

```typescript
import { volunteerApplicationInclude } from "#server/utils/prisma-select-helpers";

const applications = await prisma.editionVolunteerApplication.findMany({
  include: volunteerApplicationInclude,
});
```

**Gain** : -6 lignes, typage automatique

## 📈 Plan de migration

### Phase 1 : Endpoints critiques (1-2 jours)

Migrer les endpoints les plus utilisés :

1. ✅ `/api/editions/index.get.ts` - Liste des éditions
2. ✅ `/api/carpool-offers/[id]/index.put.ts` - Mise à jour offre
3. ✅ `/api/conventions/[id]/organizers.get.ts` - Liste organisateurs
4. ✅ `/api/editions/[id]/volunteers/applications.get.ts` - Candidatures bénévoles
5. ✅ `/api/carpool-requests/[id]/index.put.ts` - Mise à jour demande

### Phase 2 : Modules covoiturage et bénévoles (2-3 jours)

1. ✅ Tous les endpoints de covoiturage (offers + requests)
2. ✅ Tous les endpoints de bénévoles
3. ✅ Endpoints d'objets trouvés

### Phase 3 : Reste de l'API (3-4 jours)

1. ✅ Endpoints de billetterie
2. ✅ Endpoints de posts et commentaires
3. ✅ Endpoints d'administration
4. ✅ Endpoints utilisateurs

### Phase 4 : Vérification et nettoyage (1 jour)

1. ✅ Script de vérification des patterns non migrés
2. ✅ Tests de régression
3. ✅ Documentation CLAUDE.md

## 🧪 Script de vérification

Créer `scripts/check-prisma-select.ts` :

```typescript
import { glob } from "glob";
import { readFile } from "fs/promises";

async function checkPrismaSelects() {
  const apiFiles = await glob("server/api/**/*.ts");
  const patterns = [
    /select:\s*\{\s*id:\s*true,\s*pseudo:\s*true\s*\}/,
    /select:\s*\{\s*id:\s*true,\s*pseudo:\s*true,\s*profilePicture:\s*true\s*\}/,
    /select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*logo:\s*true\s*\}/,
  ];

  const filesWithOldPatterns: string[] = [];

  for (const file of apiFiles) {
    const content = await readFile(file, "utf-8");

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        filesWithOldPatterns.push(file);
        break;
      }
    }
  }

  console.log(
    `📊 Fichiers avec patterns non migrés : ${filesWithOldPatterns.length}`,
  );

  if (filesWithOldPatterns.length > 0) {
    console.log("\n⚠️ Fichiers à migrer :");
    filesWithOldPatterns.forEach((file) => console.log(`  - ${file}`));
  } else {
    console.log("✅ Tous les patterns ont été migrés !");
  }
}

checkPrismaSelects();
```

Ajouter au `package.json` :

```json
{
  "scripts": {
    "check:prisma-selects": "npx tsx scripts/check-prisma-select.ts"
  }
}
```

## 💡 Bonnes pratiques

### 1. Toujours importer depuis le helper

```typescript
// ✅ Bon
import { userBasicSelect } from "#server/utils/prisma-select-helpers";

// ❌ Mauvais - duplication
const select = { id: true, pseudo: true };
```

### 2. Étendre avec spread si besoin

```typescript
// ✅ Bon - ajouter des champs si nécessaire
select: {
  ...userBasicSelect,
  email: true,
}

// ❌ Mauvais - redéfinir tout
select: {
  id: true,
  pseudo: true,
  email: true,
}
```

### 3. Utiliser les types générés

```typescript
// ✅ Bon - type automatique
import type { UserBasic } from '#server/utils/prisma-select-helpers'

const user: UserBasic = await prisma.user.findUnique({
  select: userBasicSelect,
})

// ❌ Mauvais - type manuel
const user: { id: number; pseudo: string } = ...
```

### 4. Créer de nouveaux helpers si pattern récurrent

Si vous voyez une sélection répétée 3+ fois, ajoutez-la au fichier :

```typescript
// Dans server/utils/prisma-select-helpers.ts
export const userWithEmailSelect = {
  ...userBasicSelect,
  email: true,
} satisfies Prisma.UserSelect;
```

## 🎓 Avantages

### 1. Réduction de la duplication

- **23 occurrences** de `userBasicSelect` → 1 définition
- **~100 lignes** de code en moins dans l'API
- Modifications centralisées

### 2. Cohérence des données

- Même structure dans toute l'API
- Moins de bugs liés aux champs manquants
- Comportement prévisible

### 3. Typage automatique

- Types Prisma générés automatiquement
- IntelliSense complet
- Détection d'erreurs à la compilation

### 4. Maintenabilité

- Ajout de champs en un seul endroit
- Refactoring facilité
- Documentation vivante

### 5. Performance

- Pas d'impact négatif
- Même code généré par Prisma
- Potentiellement meilleur (sélections cohérentes)

## 📚 Ressources

- [Prisma Select API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#select)
- [Prisma Include API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#include)
- [TypeScript satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)

## 📝 Conclusion

Les helpers de sélection Prisma permettent de :

1. **Réduire la duplication** : ~100 lignes de code en moins
2. **Améliorer la cohérence** : Même structure partout
3. **Faciliter la maintenance** : Modifications centralisées
4. **Renforcer le typage** : Types générés automatiquement

**Recommandation** : Migrer progressivement les endpoints en commençant par les plus critiques, et ajouter de nouveaux helpers au fur et à mesure des besoins.
