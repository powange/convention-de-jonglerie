# Système de Tâches Automatisées (Cron)

Ce document décrit le système de tâches automatisées (cron) implémenté dans l'application.

## 📋 Vue d'ensemble

Le système utilise **Nitro Tasks** (natif Nuxt 4) + **[cron](https://github.com/kelektiv/node-cron)** (kelektiv) pour exécuter des tâches périodiques automatiques :

- 🔔 **Notifications** : Rappels bénévoles et conventions favorites
- 🧹 **Maintenance** : Nettoyage des données expirées

## 🚀 Activation du système

### En développement

```bash
# Pour activer les crons en développement
ENABLE_CRON=true npm run app1:dev
```

### En production

Le système s'active automatiquement en production (`NODE_ENV=production`).

## 📅 Tâches disponibles

### 1. Rappels bénévoles

- **Fichier** : `server/tasks/volunteer-reminders.ts`
- **Fréquence** : Chaque minute
- **Action** : Envoie des rappels 30 minutes avant les créneaux
- **Cron** : `* * * * *`

### 2. Conventions favorites

- **Fichier** : `server/tasks/convention-favorites-reminders.ts`
- **Fréquence** : Quotidien à 10h
- **Action** : Notifie 3 jours avant le début des conventions favorites
- **Cron** : `0 10 * * *`

### 3. Nettoyage tokens

- **Fichier** : `server/tasks/cleanup-expired-tokens.ts`
- **Fréquence** : Quotidien à 2h
- **Action** : Supprime les tokens de mot de passe expirés
- **Cron** : `0 2 * * *`

### 4. Nettoyage logs d'erreur

- **Fichier** : `server/tasks/cleanup-resolved-error-logs.ts`
- **Fréquence** : Mensuel (1er du mois à 3h)
- **Action** : Supprime les logs résolus > 1 mois et anciens logs > 6 mois
- **Cron** : `0 3 1 * *`

## 🛠️ APIs d'administration

### Lister les tâches

```bash
GET /api/admin/tasks
```

### Exécuter une tâche manuellement

```bash
POST /api/admin/tasks/{taskName}
```

**Tâches disponibles :**

- `volunteer-reminders`
- `convention-favorites-reminders`
- `cleanup-expired-tokens`
- `cleanup-resolved-error-logs`

## 📊 Logs et monitoring

Chaque tâche produit des logs détaillés :

```
🔔 Exécution de la tâche: rappels bénévoles
📅 Trouvé 3 créneaux dans les 30 prochaines minutes
🔔 Notification à envoyer à user@example.com
✅ Tâche terminée: 5 notifications de rappel envoyées
```

## 🔧 Personnalisation

### Ajouter une nouvelle tâche

1. **Créer le fichier de tâche :**

```typescript
// server/tasks/ma-nouvelle-tache.ts
export default defineTask({
  meta: {
    name: 'ma-nouvelle-tache',
    description: 'Description de ma tâche',
  },
  async run({ payload }) {
    // Logique de la tâche
    console.log('🚀 Exécution de ma nouvelle tâche')
    return { success: true }
  },
})
```

2. **Ajouter la planification :**

```typescript
// server/plugins/scheduler.ts
import { CronJob } from 'cron'

CronJob.from({
  cronTime: '0 */6 * * *', // Toutes les 6h
  onTick: async () => {
    try {
      await runTask('ma-nouvelle-tache')
    } catch (error) {
      console.error('Erreur:', error)
    }
  },
  start: true,
})
```

3. **Mettre à jour l'API admin :**

```typescript
// server/api/admin/tasks/index.get.ts
const availableTasks = [
  // ...autres tâches
  'ma-nouvelle-tache',
]
```

## ⚡ Bonnes pratiques

- ✅ Toujours inclure des logs détaillés
- ✅ Gérer les erreurs avec try/catch
- ✅ Retourner des statistiques d'exécution
- ✅ Tester manuellement via l'API admin
- ✅ Utiliser des fenêtres de temps pour éviter les doublons

## 🔒 Sécurité

- ✅ APIs admin protégées par authentification
- ✅ Vérification des droits administrateur
- ✅ Logs d'audit des exécutions manuelles
- ✅ Gestion robuste des erreurs
