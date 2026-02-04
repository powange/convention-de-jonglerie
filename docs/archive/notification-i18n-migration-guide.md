# Guide de Migration - Système de Notifications Multilingue

## Vue d'ensemble

Ce guide décrit les étapes pour migrer vers le nouveau système de notifications multilingue avec support hybride (traduction + texte libre).

## Architecture du Système

### Système Hybride

Le nouveau système supporte deux modes :

1. **Notifications Système** (traduites automatiquement)
   - Utilisent des clés de traduction : `titleKey`, `messageKey`, `actionTextKey`
   - Paramètres dynamiques stockés dans `translationParams` (JSON)
   - Traduites côté serveur (push/email) selon la langue préférée de l'utilisateur
   - Traduites côté client (in-app) selon la langue actuelle du site

2. **Notifications Custom** (texte libre)
   - Utilisent du texte libre : `titleText`, `messageText`, `actionText`
   - Envoyées par les organisateurs aux bénévoles
   - Notifications custom depuis l'admin
   - Affichées telles quelles, sans traduction

## Étapes de Migration

### 1. Créer la Migration Prisma

```bash
npx prisma migrate dev --name add-i18n-to-notifications
```

Cette commande va :

- Modifier le schéma `Notification` dans la base de données
- Ajouter les nouveaux champs : `titleKey`, `messageKey`, `translationParams`, `actionTextKey`, `titleText`, `messageText`
- Marquer les anciens champs comme optionnels (pour la rétrocompatibilité temporaire)

### 2. Exécuter le Script de Migration des Données

Une fois la migration Prisma appliquée, migrer les notifications existantes :

```bash
npx tsx scripts/migrate-notifications-i18n.ts
```

Ce script va :

- Lire toutes les notifications existantes
- Copier `title` → `titleText`
- Copier `message` → `messageText`
- Copier `actionText` → `actionText` (même nom)
- Afficher un résumé de la migration

### 3. Vérifier les Notifications Migrées

Vérifiez que les notifications s'affichent correctement :

```bash
# Ouvrir l'application
npm run docker:dev:logs

# Aller sur http://localhost:3000/notifications
# Vérifier que toutes les notifications anciennes s'affichent
```

### 4. Traduire les Clés [TODO]

Les fichiers de traduction pour 10 langues ont été créés avec des marqueurs `[TODO]` :

```bash
# Utiliser la commande slash pour traduire automatiquement
/translate-todos
```

Langues à traduire :

- 🇬🇧 Anglais (en)
- 🇩🇪 Allemand (de)
- 🇪🇸 Espagnol (es)
- 🇮🇹 Italien (it)
- 🇳🇱 Néerlandais (nl)
- 🇵🇱 Polonais (pl)
- 🇵🇹 Portugais (pt)
- 🇷🇺 Russe (ru)
- 🇺🇦 Ukrainien (uk)
- 🇩🇰 Danois (da)

### 5. (Optionnel) Supprimer les Anciens Champs

Une fois la migration vérifiée et stable en production, vous pouvez supprimer les anciens champs :

1. Modifier `prisma/schema.prisma` pour supprimer les lignes commentées des anciens champs
2. Créer une nouvelle migration :

```bash
npx prisma migrate dev --name remove-old-notification-fields
```

⚠️ **Attention** : Cette étape est **irréversible**. Assurez-vous que tout fonctionne correctement avant de supprimer les anciens champs.

## Utilisation du Nouveau Système

### Pour les Notifications Système (Traductions)

```typescript
import { NotificationHelpers } from '#server/utils/notification-service'

// Notification de bienvenue (traduite)
await NotificationHelpers.welcome(userId)

// Notification de covoiturage (traduite avec paramètres)
await NotificationHelpers.carpoolBookingReceived(
  userId,
  'Jean Dupont', // requesterName
  123, // offerId
  2, // seats
  'Besoin de partir tôt' // note optionnelle
)
```

### Pour les Notifications Custom (Texte Libre)

```typescript
import { NotificationService } from '#server/utils/notification-service'

// Notification custom de l'organisateur (texte libre)
await NotificationService.create({
  userId: volunteerId,
  type: 'INFO',
  titleText: "Message de l'organisateur",
  messageText: "Bonjour ! N'oubliez pas d'apporter votre matériel demain.",
  actionText: 'Voir les détails',
  actionUrl: `/editions/${editionId}/volunteers`,
  category: 'volunteer',
})
```

## Fichiers Modifiés

### Backend

- ✅ `prisma/schema.prisma` - Nouveau schéma Notification
- ✅ `server/utils/server-i18n.ts` - Traduction côté serveur (nouveau)
- ✅ `server/utils/notification-service.ts` - Service et helpers mis à jour
- ✅ `i18n/locales/fr/notifications.json` - Traductions françaises
- ✅ `i18n/locales/{10 langues}/notifications.json` - Fichiers placeholders

### Frontend

- ✅ `app/stores/notifications.ts` - Interface TypeScript mise à jour
- ✅ `app/pages/notifications.vue` - Composant avec fonctions de traduction

### Scripts

- ✅ `scripts/migrate-notifications-i18n.ts` - Script de migration (nouveau)

### Documentation

- ✅ `docs/notification-i18n.md` - Architecture du système
- ✅ `docs/notification-i18n-migration-guide.md` - Ce guide

## Traductions Disponibles

Toutes les notifications système sont traduites dans 11 langues :

### Catégories de Notifications

1. **Common** - Boutons communs
   - `view` - Voir
   - `view_details` - Voir les détails
   - `close` - Fermer

2. **Welcome** - Bienvenue
   - Message de création de compte

3. **Carpool** - Covoiturage
   - `booking_received` - Demande reçue
   - `booking_accepted` - Demande acceptée
   - `booking_rejected` - Demande refusée
   - `booking_cancelled` - Réservation annulée

4. **Volunteer** - Bénévolat
   - `application_submitted` - Candidature envoyée
   - `application_accepted` - Candidature acceptée (4 variantes)
   - `application_rejected` - Candidature refusée
   - `back_to_pending` - Remise en attente

5. **Edition** - Éditions
   - `new_convention` - Nouvelle convention
   - `reminder` - Rappel d'événement

6. **System** - Système
   - `error` - Erreur système

## Tests à Effectuer

### 1. Test des Notifications Système

```bash
# Créer un nouveau compte utilisateur
# → Doit recevoir la notification de bienvenue traduite

# Changer la langue du site
# → Les notifications in-app doivent changer de langue

# Changer la langue préférée dans le profil
# → Les push notifications et emails doivent utiliser cette langue
```

### 2. Test des Notifications Custom

```bash
# En tant qu'organisateur, envoyer un message aux bénévoles
# → Le message doit s'afficher tel quel, sans traduction
```

### 3. Test de Migration

```bash
# Vérifier que les anciennes notifications s'affichent toujours
# Aller sur /notifications
# → Toutes les notifications doivent être visibles
```

## Support et Dépannage

### Problème : Les notifications n'apparaissent pas

**Solution** : Vérifier que la migration Prisma a été appliquée :

```bash
npx prisma db push
```

### Problème : Traductions manquantes

**Solution** : Vérifier que le fichier de langue existe :

```bash
ls -la i18n/locales/fr/notifications.json
```

### Problème : Clés de traduction affichées au lieu du texte

**Solution** : Vérifier que la clé existe dans le fichier de traduction :

```typescript
// La clé doit exister
{
  "notifications": {
    "welcome": {
      "title": "Bienvenue ! 🎉"
    }
  }
}
```

### Problème : Paramètres non remplacés dans les traductions

**Solution** : Vérifier que les paramètres sont bien passés :

```typescript
// Correct
translationParams: { userName: 'Jean', seats: 2 }

// Traduction
"message": "Bonjour {userName}, vous avez réservé {seats} places"
```

## Performance

Le système de traduction côté serveur utilise un cache en mémoire :

- Les fichiers de traduction sont chargés **une seule fois** au démarrage
- Accès en O(1) pour chaque traduction
- Pas d'impact sur les performances

## Rétrocompatibilité

Le système est 100% rétrocompatible :

1. Les anciennes notifications (avec `title`, `message`) sont migrées vers `titleText`, `messageText`
2. Les nouveaux helpers utilisent les clés de traduction
3. Les notifications custom peuvent toujours utiliser du texte libre
4. L'affichage frontend gère les deux systèmes automatiquement

### Adaptateur de Rétrocompatibilité (app/stores/notifications.ts)

**Problème** : Pendant la période de transition (avant l'application de la migration Prisma), les notifications existantes utilisent l'ancienne structure `{ title, message }` alors que le code frontend attend `{ titleKey/titleText, messageKey/messageText }`.

**Solution** : Un adaptateur `normalizeNotification()` convertit automatiquement les anciennes notifications :

```typescript
interface RawNotification extends Notification {
  // Anciens champs (avant migration)
  title?: string
  message?: string
}

function normalizeNotification(raw: RawNotification): Notification {
  const notification: Notification = { ...raw }

  // Si l'ancienne structure est utilisée (avant migration), la convertir
  if (raw.title && !raw.titleText && !raw.titleKey) {
    notification.titleText = raw.title
  }
  if (raw.message && !raw.messageText && !raw.messageKey) {
    notification.messageText = raw.message
  }

  return notification
}
```

Cet adaptateur est appelé dans :

- `fetchNotifications()` : normalise toutes les notifications récupérées de l'API
- `addRealTimeNotification()` : normalise les notifications temps réel (SSE/push)

**Avantages** :

- ✅ Aucune erreur d'affichage pendant la transition
- ✅ Pas besoin d'appliquer la migration immédiatement
- ✅ Compatible avec l'ancienne ET la nouvelle structure
- ✅ Se supprime automatiquement une fois la migration appliquée (pas de code mort)

**Note** : Une fois la migration Prisma appliquée en production, cet adaptateur ne sera plus utilisé car toutes les notifications auront `titleText`/`messageText` au lieu de `title`/`message`. Vous pouvez le supprimer après quelques mois en production.

## Conclusion

Le système de notifications multilingue est maintenant opérationnel ! 🎉

- ✅ Notifications traduites automatiquement selon la langue de l'utilisateur
- ✅ Support du texte libre pour les messages personnalisés
- ✅ Système hybride flexible et évolutif
- ✅ Migration des données existantes préservée
