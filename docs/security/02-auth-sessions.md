# Rapport d'audit de securite -- Authentification et sessions

**Date :** 13 avril 2026
**Perimetre :** Authentification, sessions, mots de passe, CSRF, rate limiting, reset password, configuration de securite
**Derniere mise a jour :** 23 avril 2026

---

## 1. Vulnerabilite critique (conditionnelle)

### 1.1 Session password potentiellement vide

- **Fichier :** `nuxt.config.ts:381`
- **Severite : CRITIQUE (conditionnelle)**
- **Statut : CORRIGE**
- **Description :** Si `NUXT_SESSION_PASSWORD` n'etait pas defini, le mot de passe de chiffrement de session etait une chaine vide. Les cookies de session pouvaient etre forges.
- **Correction appliquee :** Plugin Nitro `server/plugins/validate-config.ts` qui rejette le demarrage de l'application si `NUXT_SESSION_PASSWORD` est absent ou contient moins de 32 caracteres.

---

## 2. Vulnerabilites hautes

### 2.1 Pas d'invalidation des sessions au changement de mot de passe

- **Fichiers :** `server/api/profile/change-password.post.ts`, `server/api/auth/reset-password.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE (Plan A)**
- **Description :** Le mot de passe etait mis a jour en BDD mais aucune session existante n'etait invalidee. Si un attaquant avait vole une session, le changement de mot de passe ne revoquait pas la session volee.
- **Correction appliquee :** Appel de `clearUserSession(event)` apres l'update du mot de passe dans les deux endpoints. Force la re-authentification de l'utilisateur courant.
- **Limite (suivi possible) :** Le `clearUserSession` n'invalide que la session de l'appareil qui fait la requete. Pour invalider toutes les sessions multi-device, prevoir un mecanisme de versionning (`User.sessionVersion` en BDD + middleware) -- non fait car necessite migration.

### 2.2 Brute force sur codes de verification a 6 chiffres

- **Fichiers :** `server/api/auth/verify-email.post.ts`, `server/api/auth/set-password-and-verify.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Codes a 6 chiffres (1M combinaisons) sans rate limiting.
- **Correction appliquee :** `verificationCodeRateLimiter` (5 tentatives / 15 min par IP) ajoute aux deux endpoints.

### 2.3 Generation de codes avec `Math.random()`

- **Fichiers :** `server/utils/emailService.ts`, `server/api/conventions/[id]/claim.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** `Math.random()` n'est pas cryptographiquement securise. Les codes generes etaient previsibles.
- **Correction appliquee :** Remplacement par `crypto.randomInt(100000, 1000000)` (CSPRNG).

---

## 3. Vulnerabilites moyennes

### 3.1 Absence de protection CSRF

- **Fichiers :** `server/utils/csrf.ts`, `server/middleware/00.csrf.ts`, `app/plugins/csrf.client.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** Aucune protection CSRF explicite n'etait implementee. Les cookies `SameSite=Lax` offraient une protection partielle.
- **Correction appliquee :** Implementation du pattern **Double Submit Cookie** :
  - **Helper serveur** (`server/utils/csrf.ts`) : `ensureCsrfToken()` genere un token random 32 bytes hex et le persiste dans un cookie non-httpOnly. `assertCsrfToken()` compare cookie vs header `x-csrf-token` en temps constant via `timingSafeEqual`.
  - **Middleware Nitro** (`server/middleware/00.csrf.ts`) : Set le cookie sur toute requete. Valide le header sur POST/PUT/PATCH/DELETE. Exempte les methodes safe (GET/HEAD/OPTIONS), le webhook Stripe (`/api/project-costs/webhook` -- signature dediee) et les callbacks OAuth (`/auth/google`, `/auth/facebook`). Prefixe `00.` pour s'executer avant `auth.ts`.
  - **Plugin client** (`app/plugins/csrf.client.ts`) : Wrappe `globalThis.$fetch` avec un `onRequest` interceptor qui injecte automatiquement le header `x-csrf-token` lu depuis le cookie sur toutes les mutations.

### 3.2 Enumeration d'emails via `check-email`

- **Fichier :** `server/api/auth/check-email.post.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** Endpoint public, sans rate limiting, qui revelait si un email etait enregistre.
- **Correction appliquee :** `checkEmailRateLimiter` (10 requetes / minute par IP) ajoute en debut d'endpoint.

### 3.3 `Math.random()` pour tokens OAuth state

- **Fichiers :** `server/routes/auth/google.get.ts`, `server/routes/auth/facebook.get.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** Le parametre `state` OAuth doit etre imprevisible pour prevenir les attaques CSRF sur le flux OAuth.
- **Correction appliquee :** Remplacement par `crypto.randomBytes(32).toString('hex')`.

### 3.4 Rate limiting manquant sur plusieurs endpoints

- **Severite : MOYENNE**
- **Statut : CORRIGE**

| Endpoint                          | Rate limiter applique                          |
| --------------------------------- | ---------------------------------------------- |
| `request-password-reset.post.ts`  | `passwordResetRateLimiter` (3 / 15 min par IP) |
| `reset-password.post.ts`          | `authRateLimiter` (5 / min par IP)             |
| `verify-email.post.ts`            | `verificationCodeRateLimiter` (5 / 15 min)     |
| `set-password-and-verify.post.ts` | `verificationCodeRateLimiter` (5 / 15 min)     |
| `check-email.post.ts`             | `checkEmailRateLimiter` (10 / min par IP)      |

Les rate limiters dedies sont definis dans `server/utils/rate-limiter.ts`.

---

## 4. Vulnerabilites basses

### 4.1 Salt rounds bcrypt inconsistant

- **Fichiers :** `register.post.ts`, `reset-password.post.ts`, `set-password-and-verify.post.ts`
- **Statut : CORRIGE**
- **Description :** Salt rounds 10 dans certains endpoints, 12 dans d'autres.
- **Correction appliquee :** Harmonisation a 12 partout. Note : `anonymize-users.post.ts` reste a 10 car il s'agit d'un mot de passe generique pour comptes desactives (pas critique).

### 4.2 Tokens de reset non nettoyes en BDD

- **Fichier :** `server/api/auth/reset-password.post.ts`
- **Statut : CORRIGE**
- **Description :** Les tokens etaient marques `used: true` mais jamais supprimes.
- **Correction appliquee :** `prisma.passwordResetToken.deleteMany({ where: { userId } })` apres reset reussi. Supprime tous les tokens du user (force revocation des autres tokens en attente + nettoyage BDD).

### 4.3 Rate limiter en memoire

- **Fichier :** `server/utils/rate-limiter.ts`
- **Statut : ACCEPTE** (mono-instance en production)
- **Description :** `Map` en memoire avec nettoyage toutes les 10 minutes. En multi-instances, chaque instance aurait son propre compteur, ce qui diluerait l'efficacite du rate limiting.
- **Decision :** L'application est deployee sur **une seule instance** en production. Le rate limiter en memoire est donc suffisant. A migrer vers Redis (via `@unjs/storage` driver redis ou `ioredis`) le jour ou l'application passera en multi-instances.

### 4.4 Fixation de session

- **Severite : FAIBLE**
- **Statut : NON TRAITE** (risque residuel acceptable)
- **Description :** Les sessions sont creees/remplacees a la connexion via `setUserSession()`. Le risque est faible grace aux cookies scelles mais l'absence de rotation explicite du cookie merite attention. A revoir si une rotation systematique est souhaitee.

---

## Resume des corrections

| #   | Faille                                            | Severite                | Statut           |
| --- | ------------------------------------------------- | ----------------------- | ---------------- |
| 1.1 | Session password potentiellement vide             | CRITIQUE (conditionnel) | CORRIGE          |
| 2.1 | Pas d'invalidation des sessions au changement mdp | HAUTE                   | CORRIGE (Plan A) |
| 2.2 | Brute force codes 6 chiffres                      | HAUTE                   | CORRIGE          |
| 2.3 | Math.random() pour codes                          | HAUTE                   | CORRIGE          |
| 3.1 | Absence de protection CSRF                        | MOYENNE                 | CORRIGE          |
| 3.2 | Enumeration emails check-email                    | MOYENNE                 | CORRIGE          |
| 3.3 | Math.random() pour tokens OAuth state             | MOYENNE                 | CORRIGE          |
| 3.4 | Rate limiting manquant                            | MOYENNE                 | CORRIGE          |
| 4.1 | Salt rounds bcrypt inconsistant                   | BASSE                   | CORRIGE          |
| 4.2 | Tokens reset non nettoyes                         | BASSE                   | CORRIGE          |
| 4.3 | Rate limiter en memoire                           | BASSE                   | ACCEPTE          |
| 4.4 | Fixation de session                               | FAIBLE                  | NON TRAITE       |

**Score : 10 corrigees / 1 acceptee / 1 non traitee (risque residuel faible)**

---

## Points positifs

- Hachage bcrypt correct avec salt rounds harmonise a 12
- Validation de complexite des mots de passe via schema Zod (min 8 chars, majuscule, chiffre)
- Rate limiting en place sur tous les endpoints d'authentification sensibles
- Tokens de reset robustes : `randomBytes(32)`, expiration configurable, deleteMany apres usage
- Message generique au reset password (pas d'enumeration)
- Hash de mot de passe jamais expose dans les reponses API
- Deconnexion correcte avec `clearUserSession`
- CSP solide avec nonce + SRI
- Cookies OAuth avec `httpOnly`, `sameSite: 'lax'`, `secure` en prod, `maxAge: 600`
- Cookie d'impersonation chiffre/signe via `useSession` h3
- Protection CSRF Double Submit Cookie sur toutes les mutations
- Generateurs cryptographiquement surs (`crypto.randomInt`, `crypto.randomBytes`) partout
- Plugin de validation au demarrage qui rejette une `NUXT_SESSION_PASSWORD` invalide
