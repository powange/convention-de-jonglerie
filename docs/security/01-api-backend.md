# Rapport d'audit de securite -- API Backend

**Date :** 13 avril 2026
**Perimetre :** `server/api/`, `server/routes/`, `server/middleware/`, `server/utils/`
**Derniere mise a jour :** 14 avril 2026

---

## 1. Vulnerabilites critiques

### 1.1 Cookie d'impersonation non signe -- Escalade de privileges

- **Fichiers :** `server/utils/impersonation-helpers.ts`, `server/api/admin/impersonate/stop.post.ts`
- **Severite : CRITIQUE**
- **Statut : CORRIGE**
- **Description :** Le cookie d'impersonation etait stocke en JSON en clair (`JSON.stringify`) avec juste le flag `httpOnly`. Un attaquant authentifie pouvait forger un cookie avec `originalUserId` pointant vers un admin global, puis appeler `POST /api/admin/impersonate/stop` pour obtenir une session admin complete.
- **Correction appliquee :** Remplacement par `useSession` de h3 qui utilise des cookies chiffres et signes (meme mecanisme que `nuxt-auth-utils`). Le secret de chiffrement est `NUXT_SESSION_PASSWORD`. Les fonctions sont devenues asynchrones et les 3 appelants ont ete mis a jour (`impersonate.post.ts`, `stop.post.ts`, `me.get.ts`).

### 1.2 Path Traversal sur le telechargement de backups

- **Fichiers :** `server/api/admin/backup/download.get.ts`, `server/api/admin/backup/delete.delete.ts`, `server/api/admin/backup/restore.post.ts`
- **Severite : CRITIQUE** (attenuee par la protection admin)
- **Statut : CORRIGE**
- **Description :** Le parametre `filename` etait joint directement au chemin avec `path.join(process.cwd(), 'backups', filename)`. Un admin pouvait envoyer `../../../etc/passwd.sql` pour lire des fichiers arbitraires.
- **Correction appliquee :** Ajout de `path.basename(filename)` dans les 3 fichiers pour ne garder que le nom de fichier, rendant le path traversal impossible.

---

## 2. Vulnerabilites hautes

### 2.1 Path Traversal sur le service de fichiers uploads (route)

- **Fichier :** `server/routes/uploads/[...path].get.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Contrairement a `server/api/uploads/[...path].get.ts` qui avait une protection anti-traversal, le handler dans `server/routes/` n'avait aucune protection.
- **Correction appliquee :** Ajout des memes protections : verification de `..` et `//`, verification `startsWith(uploadDir)`, et protection sur le fallback `public/uploads`.

### 2.2 Endpoints admin sans verification BDD du statut admin

- **Fichiers :**
  - `server/api/admin/conventions/[id].delete.ts`
  - `server/api/admin/users/[id]/impersonate.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Ces endpoints verifiaient le flag `isGlobalAdmin` depuis les donnees de session (cookie), pas depuis la base de donnees. Si un admin etait revoque mais que sa session etait encore active, il conservait l'acces.
- **Correction appliquee :** Remplacement par `requireGlobalAdminWithDbCheck(event)` qui verifie le statut admin en BDD.

### 2.3 Absence de rate limiting sur les endpoints d'authentification sensibles

- **Fichiers :** `request-password-reset.post.ts`, `reset-password.post.ts`, `verify-email.post.ts`, `set-password-and-verify.post.ts`, `check-email.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Seuls `login`, `register` et `resend-verification` avaient un rate limiter.
- **Correction appliquee :** Ajout de rate limiters dedies :
  - `verify-email` et `set-password-and-verify` : `verificationCodeRateLimiter` (5 tentatives / 15 min) -- protection brute force sur codes a 6 chiffres
  - `request-password-reset` : `emailRateLimiter` (3 / 15 min) -- protection spam d'emails
  - `reset-password` : `authRateLimiter` (5 / min)
  - `check-email` : `checkEmailRateLimiter` (10 / min) -- protection enumeration d'emails
  - Deux nouveaux rate limiters crees dans `server/utils/rate-limiter.ts` : `verificationCodeRateLimiter` et `checkEmailRateLimiter`

---

## 3. Vulnerabilites moyennes

### 3.1 Absence de sanitisation XSS sur les contenus stockes

- **Fichiers :**
  - `server/utils/commentsHandler.ts`
  - `server/api/messenger/conversations/[conversationId]/messages/index.post.ts`
  - `server/api/editions/[id]/posts/index.post.ts`
  - `server/api/carpool-offers/[id]/bookings.post.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** Les contenus UGC (messages, commentaires, posts) n'etaient pas sanitises contre les scripts.
- **Correction appliquee :** Creation de `sanitizeUserContent()` dans `server/utils/validation-helpers.ts` qui echappe `<`, `>`, `&`. Appliquee dans les 4 fichiers concernes.

### 3.2 Validation d'entrees manquante (~33 endpoints)

- **Fichiers principaux corriges :**
  - `server/api/carpool-offers/[id]/bookings.post.ts`
  - `server/api/notifications/fcm/subscribe.post.ts`
  - `server/api/editions/[id]/lost-found/index.post.ts`
- **Severite : MOYENNE**
- **Statut : PARTIELLEMENT CORRIGE** (3 endpoints sur ~33)
- **Description :** ~33 endpoints sur ~159 utilisant `readBody` n'utilisaient pas de schema Zod.
- **Correction appliquee :** Ajout de schemas Zod (`bookingSchema`, `fcmSubscribeSchema`, `lostFoundSchema`) sur les 3 endpoints les plus critiques. Les ~30 endpoints restants sont un chantier a traiter progressivement.

### 3.3 Controle d'acces manquant sur la creation de posts

- **Fichier :** `server/api/editions/[id]/posts/index.post.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** N'importe quel utilisateur authentifie pouvait creer un post sur n'importe quelle edition sans verification de permission.
- **Correction appliquee :** Ajout de `canAccessEditionData(editionId, user.id, event)` pour verifier que l'utilisateur est organisateur de l'edition avant de creer un post.

### 3.4 Bug deleteCommentForEntity -- mauvais modele Prisma

- **Fichier :** `server/utils/commentsHandler.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** La fonction utilisait toujours `prisma.carpoolComment` pour le `findUnique` et le `delete`, meme quand `config.entityType` etait `carpoolRequest`.
- **Correction appliquee :** Utilisation dynamique du bon modele (`carpoolComment` ou `carpoolRequestComment`) via `(prisma as any)[modelName]`, comme dans `createCommentForEntity`.

### 3.5 Credentials HelloAsso transitant par le navigateur

- **Fichier :** `server/api/editions/[id]/ticketing/helloasso/orders.post.ts`
- **Severite : MOYENNE**
- **Statut : NON CORRIGE** (changement architectural necessaire)
- **Description :** Le `clientId` et `clientSecret` HelloAsso sont envoyes depuis le frontend dans le body de la requete.
- **Correction recommandee :** Stocker les credentials cote serveur (variables d'environnement ou configuration chiffree en BDD). Ce changement implique des modifications frontend, backend et potentiellement du schema de base de donnees.

---

## 4. Vulnerabilites basses

### 4.1 Fonction `requireSuperAdmin` inexistante

- **Fichier :** `server/api/admin/notifications/test-firebase.post.ts`
- **Severite : BASSE**
- **Statut : CORRIGE**
- **Description :** L'endpoint appelait `requireSuperAdmin(event, 'Acces refuse')` mais cette fonction n'existait pas. L'endpoint produisait une erreur 500 runtime.
- **Correction appliquee :** Remplacement par `await requireGlobalAdminWithDbCheck(event)`.

### 4.2 `$executeRawUnsafe` dans l'anonymisation

- **Fichier :** `server/api/admin/anonymize-users.post.ts`
- **Severite : BASSE**
- **Statut : CORRIGE**
- **Description :** Utilisait `$executeRawUnsafe` avec des placeholders `?` (parametrise correctement mais fonction a risque).
- **Correction appliquee :** Remplacement par `$executeRaw` avec template literal tagge Prisma et `Prisma.join(ids)`.

---

## Resume des corrections

| #   | Faille                            | Severite | Statut          |
| --- | --------------------------------- | -------- | --------------- |
| 1.1 | Cookie impersonation non signe    | CRITIQUE | CORRIGE         |
| 1.2 | Path traversal backup             | CRITIQUE | CORRIGE         |
| 2.1 | Path traversal route uploads      | HAUTE    | CORRIGE         |
| 2.2 | Endpoints admin sans verif BDD    | HAUTE    | CORRIGE         |
| 2.3 | Rate limiting auth manquant       | HAUTE    | CORRIGE         |
| 3.1 | Sanitisation XSS manquante        | MOYENNE  | CORRIGE         |
| 3.2 | Validation Zod manquante          | MOYENNE  | PARTIEL (3/~33) |
| 3.3 | Controle d'acces posts            | MOYENNE  | CORRIGE         |
| 3.4 | Bug deleteComment modele          | MOYENNE  | CORRIGE         |
| 3.5 | Credentials HelloAsso cote client | MOYENNE  | NON CORRIGE     |
| 4.1 | requireSuperAdmin inexistante     | BASSE    | CORRIGE         |
| 4.2 | $executeRawUnsafe                 | BASSE    | CORRIGE         |

**Score : 10/12 corrigees (dont 1 partielle)**

---

## Points positifs

- Middleware d'authentification centralise avec liste declarative de routes publiques
- Double verification admin (session + BDD) via `requireGlobalAdminWithDbCheck` (desormais sur tous les endpoints admin)
- Validation Zod sur ~129/159 endpoints (ameliore de ~126)
- Protection IDOR systematique via `requireResourceOwner`
- Webhook Stripe avec verification de signature correcte
- Pas d'injection SQL (Prisma template literals)
