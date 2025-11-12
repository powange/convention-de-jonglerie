# Améliorations des logs d'erreur API

## Vue d'ensemble

Ce document décrit les améliorations apportées au système de logs d'erreur API pour enrichir le contexte et faciliter le debugging.

## Nouvelles fonctionnalités

### 1. Page d'origine (Referer)

**Champ ajouté** : `referer` (String, nullable)

Le champ `referer` capture l'URL complète de la page depuis laquelle l'appel API a été effectué. Cela permet de :

- Identifier le contexte d'utilisation qui a causé l'erreur
- Tracer le parcours utilisateur avant l'erreur
- Comprendre quelle page/composant a déclenché l'appel API problématique

**Exemple** :

```
referer: "https://convention-de-jonglerie.com/editions/123/gestion/volunteers/teams"
```

### 2. Domaine d'origine (Origin)

**Champ ajouté** : `origin` (String, nullable)

Le champ `origin` capture le domaine d'origine de la requête. Utile pour :

- Détecter les requêtes cross-origin
- Identifier les appels depuis des domaines non autorisés
- Tracer les problèmes CORS

**Exemple** :

```
origin: "https://convention-de-jonglerie.com"
```

### 3. Amélioration de la capture du body POST

**Améliorations apportées** :

- Capture améliorée du body dans plusieurs contextes possibles (`event.context._body`, `event.context.body`, `event._body`)
- Meilleure gestion des cas où le body a déjà été consommé par l'API
- Le body est maintenant **affiché par défaut** dans la liste des logs admin (sanitisé)

**Données capturées** :

- Tous les champs du body POST
- Sanitisation automatique des données sensibles (mots de passe, tokens, etc.)
- Conservation partielle des emails (domaine uniquement)

**Exemple de body sanitisé** :

```json
{
  "email": "***@example.com",
  "password": "***REDACTED***",
  "firstName": "Jean",
  "lastName": "Dupont",
  "applicationId": 123
}
```

## Schéma de base de données

### Migration requise

```bash
npx prisma migrate dev --name add_referer_origin_to_api_error_log
```

### Nouveaux champs dans ApiErrorLog

```prisma
model ApiErrorLog {
  // ... champs existants ...

  referer         String?  @db.Text // Page d'origine de la requête
  origin          String?  // Domaine d'origine

  // ... autres champs ...
}
```

## Fichiers modifiés

### 1. `prisma/schema.prisma`

- Ajout des champs `referer` et `origin` au modèle `ApiErrorLog`

### 2. `server/utils/error-logger.ts`

- Capture du header `referer` (avec fallback sur `referrer`)
- Capture du header `origin`
- Amélioration de la capture du body avec plusieurs fallbacks
- Ajout des nouveaux champs dans la création du log

### 3. `server/plugins/error-logging.ts`

- Amélioration de la stratégie de capture du body
- Vérification de plusieurs emplacements possibles pour le body
- Meilleure gestion des cas où le body a déjà été consommé

### 4. `server/api/admin/error-logs.get.ts`

- Ajout de `referer` et `origin` dans le select de la liste des logs
- Le champ `body` est maintenant inclus par défaut (sanitisé)

### 5. `server/api/admin/error-logs/[id].get.ts`

- Ajout de `referer` et `origin` dans le select des détails d'un log

## Utilisation

### Consulter les logs avec le nouveau contexte

#### API - Liste des logs

```
GET /api/admin/error-logs
```

**Réponse** (extrait) :

```json
{
  "logs": [
    {
      "id": "clx123abc",
      "message": "Validation error",
      "statusCode": 400,
      "method": "POST",
      "path": "/api/editions/123/volunteers/applications",
      "referer": "https://convention-de-jonglerie.com/editions/123/volunteers",
      "origin": "https://convention-de-jonglerie.com",
      "ip": "192.168.1.1",
      "body": {
        "email": "***@example.com",
        "motivation": "Je souhaite aider..."
      },
      "queryParams": {},
      "user": {
        "id": 42,
        "pseudo": "john_doe"
      },
      "createdAt": "2025-10-14T10:30:00Z"
    }
  ]
}
```

#### API - Détails d'un log

```
GET /api/admin/error-logs/{id}
```

**Réponse** (extrait) :

```json
{
  "id": "clx123abc",
  "message": "Validation error",
  "statusCode": 400,
  "stack": "./server/api/editions/[id]/volunteers/applications.post.ts:25\n...",
  "errorType": "ValidationError",
  "method": "POST",
  "url": "/api/editions/123/volunteers/applications",
  "path": "/api/editions/123/volunteers/applications",
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1",
  "referer": "https://convention-de-jonglerie.com/editions/123/volunteers",
  "origin": "https://convention-de-jonglerie.com",
  "headers": {
    "accept": "application/json",
    "content-type": "application/json",
    "cookie": "***REDACTED***",
    "authorization": "***REDACTED***"
  },
  "body": {
    "email": "***@example.com",
    "password": "***REDACTED***",
    "motivation": "Je souhaite aider...",
    "teamPreferences": [1, 2, 3]
  },
  "queryParams": {},
  "user": {
    "id": 42,
    "pseudo": "john_doe",
    "email": "john.doe@example.com"
  },
  "resolved": false,
  "createdAt": "2025-10-14T10:30:00Z"
}
```

## Sécurité et confidentialité

### Données sanitisées automatiquement

Les champs suivants sont **toujours masqués** dans le body :

- `password`, `newPassword`, `currentPassword`, `confirmPassword`
- `token`, `accessToken`, `refreshToken`, `apiKey`
- `secret`, `privateKey`
- `phone` (numéro complet masqué)
- `email` (seul le domaine est conservé : `***@example.com`)

### Headers sanitisés

Les headers suivants sont **toujours masqués** :

- `authorization`
- `cookie`
- `x-api-key`
- `x-auth-token`, `x-session-token`, `x-access-token`, `x-refresh-token`

## Cas d'usage

### 1. Debugging d'une erreur de validation

**Problème** : Un utilisateur reçoit une erreur lors de la soumission d'un formulaire.

**Solution** : Consulter le log pour voir :

- La page d'origine (`referer`) : `/editions/123/volunteers`
- Le body de la requête : identifier quel champ pose problème
- Le contexte utilisateur : voir si l'erreur est spécifique à un utilisateur

### 2. Traçage d'un parcours utilisateur

**Problème** : Comprendre comment un utilisateur est arrivé à une erreur.

**Solution** : Filtrer les logs par `userId` et observer la séquence de `referer` pour reconstituer le parcours.

### 3. Détection d'attaques ou d'abus

**Problème** : Détecter des appels API suspects.

**Solution** :

- Vérifier le champ `origin` pour identifier des domaines non autorisés
- Observer les patterns de `referer` inhabituels
- Analyser les `body` pour détecter des injections

### 4. Amélioration de l'UX

**Problème** : Identifier les pages qui génèrent le plus d'erreurs.

**Solution** : Grouper les logs par `referer` et identifier les pages problématiques pour les améliorer.

## Statistiques et monitoring

Les champs `referer` et `origin` peuvent être utilisés pour :

- Créer des graphiques de "pages sources d'erreurs"
- Détecter les patterns d'erreurs par origine
- Identifier les workflows utilisateurs problématiques
- Optimiser les pages les plus critiques

## Prochaines améliorations possibles

1. **Graphiques de tendance** : Visualiser les erreurs par page source dans le dashboard admin
2. **Alertes automatiques** : Notifier les admins si une page génère un nombre anormal d'erreurs
3. **Corrélation d'erreurs** : Lier automatiquement les erreurs du même utilisateur sur la même session
4. **Export des logs** : Permettre l'export des logs pour analyse externe
5. **Recherche par referer** : Ajouter un filtre de recherche par page source

## Notes techniques

- Les champs `referer` et `origin` sont **nullables** car certaines requêtes peuvent ne pas avoir ces headers (API calls directs, tests, etc.)
- Le body est capturé de manière opportuniste : si le stream a déjà été consommé, on essaie de le récupérer depuis le contexte
- La sanitisation des données est effectuée **avant** l'enregistrement en base de données pour garantir la sécurité
