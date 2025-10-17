# Système de notifications multilingues

## Objectif

Permettre l'affichage des notifications dans la langue appropriée :

- **Notifications dans l'application** : langue actuellement sélectionnée sur le site
- **Notifications push** : langue préférée de l'utilisateur (stockée dans son profil)

## Architecture

### 1. Stockage en base de données

Le modèle `Notification` est modifié pour stocker des clés de traduction au lieu de texte brut :

```prisma
model Notification {
  id                String           @id @default(cuid())
  userId            Int
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Clés de traduction au lieu de texte brut
  type              NotificationType
  titleKey          String           // Clé de traduction pour le titre
  messageKey        String           // Clé de traduction pour le message
  translationParams Json?            // Paramètres pour les traductions (noms, dates, etc.)

  // Métadonnées pour le contexte
  category          String?          // 'edition', 'volunteer', 'system', etc.
  entityType        String?          // Type d'entité liée (Edition, User, etc.)
  entityId          String?          // ID de l'entité liée

  // États de lecture
  isRead            Boolean          @default(false)
  readAt            DateTime?

  // Actions optionnelles
  actionUrl         String?          @db.Text
  actionTextKey     String?          // Clé de traduction pour le texte du bouton

  // Timestamps
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@index([category])
}
```

### 2. Fichiers de traduction

Structure : `i18n/locales/{langue}/notifications.json`

```json
{
  "notifications": {
    "welcome": {
      "title": "Bienvenue ! 🎉",
      "message": "Votre compte a été créé avec succès. Découvrez les conventions de jonglerie près de chez vous !",
      "action": "Voir les conventions"
    },
    "carpool": {
      "booking_received": {
        "title": "Nouvelle demande de covoiturage 🚗",
        "message": "{requesterName} souhaite réserver {seats} place(s) dans votre covoiturage",
        "message_with_note": "{requesterName} souhaite réserver {seats} place(s) : \"{note}\"",
        "action": "Voir la demande"
      },
      "booking_accepted": {
        "title": "Demande acceptée ! ✅",
        "message": "{ownerName} a accepté votre demande de {seats} place(s) pour le trajet au départ de {city} le {date}",
        "action": "Voir les détails"
      },
      "booking_rejected": {
        "title": "Demande refusée",
        "message": "{ownerName} a refusé votre demande de {seats} place(s) pour le trajet au départ de {city}",
        "action": "Voir d'autres offres"
      },
      "booking_cancelled": {
        "title": "Réservation annulée 📅",
        "message": "{passengerName} a annulé sa réservation de {seats} place(s) pour le trajet au départ de {city} le {date}",
        "action": "Voir le covoiturage"
      }
    },
    "volunteer": {
      "application_submitted": {
        "title": "Candidature envoyée ! 🎉",
        "message": "Votre candidature pour \"{editionName}\" a été envoyée. Les organisateurs vont l'examiner.",
        "action": "Voir mes candidatures"
      },
      "application_accepted": {
        "title": "Candidature acceptée ! ✅",
        "message": "Votre candidature pour \"{editionName}\" a été acceptée.",
        "message_with_teams": "Votre candidature pour \"{editionName}\" a été acceptée. Équipe(s) : {teams}",
        "message_with_note": "Votre candidature pour \"{editionName}\" a été acceptée.\\n\\nMessage de l'organisateur : \"{note}\"",
        "action": "Voir les détails"
      },
      "application_rejected": {
        "title": "Candidature non retenue",
        "message": "Votre candidature pour \"{editionName}\" n'a pas été retenue cette fois.",
        "action": "Voir l'édition"
      }
    }
  }
}
```

### 3. Service de traduction côté serveur

Créer `server/utils/server-i18n.ts` :

```typescript
import fs from 'node:fs'
import path from 'node:path'

// Cache des traductions chargées
const translationsCache = new Map<string, any>()

/**
 * Charge les traductions pour une langue donnée
 */
function loadTranslations(lang: string): any {
  if (translationsCache.has(lang)) {
    return translationsCache.get(lang)
  }

  const localesDir = path.resolve(process.cwd(), 'i18n/locales', lang)
  const merged: any = {}

  try {
    // Lire tous les fichiers JSON du dossier de langue
    const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(localesDir, file)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      Object.assign(merged, content)
    }

    translationsCache.set(lang, merged)
    return merged
  } catch (error) {
    console.error(`[Server i18n] Erreur chargement langue ${lang}:`, error)
    return {}
  }
}

/**
 * Traduit une clé avec des paramètres
 */
export function translateServerSide(
  key: string,
  params: Record<string, any> = {},
  lang: string = 'fr'
): string {
  const translations = loadTranslations(lang)

  // Naviguer dans l'objet avec la notation pointée
  const keys = key.split('.')
  let value: any = translations

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k]
    } else {
      value = undefined
      break
    }
  }

  if (typeof value !== 'string') {
    console.warn(`[Server i18n] Clé manquante: ${key} (lang: ${lang})`)
    return key // Retourner la clé si la traduction n'existe pas
  }

  // Remplacer les paramètres {param} dans la chaîne
  let result = value
  for (const [paramKey, paramValue] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
  }

  return result
}

/**
 * Invalider le cache des traductions (utile en développement)
 */
export function clearTranslationsCache() {
  translationsCache.clear()
}
```

### 4. Modification du NotificationService

```typescript
export interface CreateNotificationData {
  userId: number
  type: NotificationType
  titleKey: string                    // Au lieu de title
  messageKey: string                  // Au lieu de message
  translationParams?: Record<string, any>  // Nouveau
  category?: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  actionTextKey?: string              // Au lieu de actionText
  notificationType?: CustomNotificationType
}

async create(data: CreateNotificationData) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      titleKey: data.titleKey,
      messageKey: data.messageKey,
      translationParams: data.translationParams || {},
      category: data.category,
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
      actionTextKey: data.actionTextKey,
    },
  })

  // Pour les push, traduire dans la langue préférée
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { preferredLanguage: true }
  })

  const lang = user?.preferredLanguage || 'fr'

  const pushData = {
    title: translateServerSide(data.titleKey, data.translationParams, lang),
    message: translateServerSide(data.messageKey, data.translationParams, lang),
    url: data.actionUrl,
    actionText: data.actionTextKey
      ? translateServerSide(data.actionTextKey, data.translationParams, lang)
      : undefined,
  }

  await pushNotificationService.sendToUser(data.userId, pushData)

  return notification
}
```

### 5. Composant de notifications

Le composant affiche les notifications dans la langue actuelle :

```vue
<script setup>
const { t } = useI18n()

const displayTitle = computed(() => t(notification.titleKey, notification.translationParams || {}))

const displayMessage = computed(() =>
  t(notification.messageKey, notification.translationParams || {})
)

const displayActionText = computed(() =>
  notification.actionTextKey
    ? t(notification.actionTextKey, notification.translationParams || {})
    : t('common.view')
)
</script>
```

## Migration

Pour les notifications existantes, créer un script de migration qui :

1. Détecte les patterns de messages existants
2. Convertit les messages en clés de traduction
3. Extrait les paramètres (noms, dates, etc.)

## Avantages

- ✅ Notifications dans la langue de l'interface pour l'app
- ✅ Notifications push dans la langue préférée de l'utilisateur
- ✅ Facilite la maintenance (une seule source de vérité par langue)
- ✅ Permet d'ajouter facilement de nouvelles langues
- ✅ Cohérence avec le système i18n existant

## Inconvénients

- ⚠️ Migration nécessaire pour les notifications existantes
- ⚠️ Complexité légèrement accrue du code
- ⚠️ Nécessite de définir toutes les clés de traduction à l'avance
