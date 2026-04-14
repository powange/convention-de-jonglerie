# Rapport d'audit de securite -- Authentification et sessions

**Date :** 13 avril 2026
**Perimetre :** Authentification, sessions, mots de passe, CSRF, rate limiting, reset password, configuration de securite

---

## 1. Vulnerabilite critique (conditionnelle)

### 1.1 Session password potentiellement vide

- **Fichier :** `nuxt.config.ts:381`
- **Severite : CRITIQUE (conditionnelle)**
- **Description :**
  ```typescript
  sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
  ```
  Si `NUXT_SESSION_PASSWORD` n'est pas defini, le mot de passe de chiffrement de session est une chaine vide. Les cookies de session pourraient etre forges.
- **Correction :** Ajouter une verification au demarrage qui refuse de lancer le serveur si `NUXT_SESSION_PASSWORD` n'est pas defini ou fait moins de 32 caracteres.

---

## 2. Vulnerabilites hautes

### 2.1 Pas d'invalidation des sessions au changement de mot de passe

- **Fichiers :** `server/api/auth/change-password.post.ts`, `server/api/auth/reset-password.post.ts`
- **Severite : HAUTE**
- **Description :** Le mot de passe est mis a jour en BDD mais aucune session existante n'est invalidee. Avec `nuxt-auth-utils`, les sessions sont dans des cookies scelles cote client -- il n'y a pas de store de sessions cote serveur pour les invalider.
- **Impact :** Si un attaquant a vole une session, le changement de mot de passe par la victime ne revoque pas la session volee.
- **Correction :** Implementer un mecanisme de version de session (`sessionVersion` en BDD incremente a chaque changement de mot de passe, verifie dans le middleware). Au minimum, appeler `clearUserSession(event)` pour forcer la re-authentification de l'utilisateur courant.

### 2.2 Brute force sur codes de verification a 6 chiffres

- **Fichiers :** `server/api/auth/verify-email.post.ts`, `server/api/auth/set-password-and-verify.post.ts`
- **Severite : HAUTE**
- **Description :** Codes a 6 chiffres (1M combinaisons) sans rate limiting ni blocage apres N echecs.
- **Correction :** Ajouter un rate limiter et un blocage progressif.

### 2.3 Generation de codes avec `Math.random()`

- **Fichiers :** `server/utils/emailService.ts:118`, `server/api/conventions/[id]/claim.post.ts:48`
- **Severite : HAUTE**
- **Description :**
  ```typescript
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  ```
  `Math.random()` n'est pas cryptographiquement securise. Les codes generes sont previsibles.
- **Correction :** Utiliser `crypto.randomInt(100000, 999999)` de Node.js.

---

## 3. Vulnerabilites moyennes

### 3.1 Absence de protection CSRF

- **Severite : MOYENNE**
- **Description :** Aucune protection CSRF explicite n'est implementee. Le test unitaire `brute-force.test.ts` definit une fonction `isValidCSRFToken` mais elle n'est jamais utilisee en production. Les cookies `SameSite=Lax` offrent une protection partielle.
- **Correction :** Activer la protection CSRF de `nuxt-security` ou implementer un middleware CSRF.

### 3.2 Enumeration d'emails via `check-email`

- **Fichier :** `server/api/auth/check-email.post.ts:28`
- **Severite : MOYENNE**
- **Description :**
  ```typescript
  return createSuccessResponse({ exists: !!user })
  ```
  Endpoint public, sans rate limiting, qui revele si un email est enregistre.
- **Correction :** Ajouter un rate limiting. Envisager de combiner avec le flux d'inscription.

### 3.3 `Math.random()` pour tokens OAuth state

- **Fichiers :** `server/routes/auth/google.get.ts:42`, `server/routes/auth/facebook.get.ts:42`
- **Severite : MOYENNE**
- **Description :**
  ```typescript
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  ```
  Le parametre `state` OAuth doit etre imprevisible pour prevenir les attaques CSRF sur le flux OAuth.
- **Correction :** Utiliser `crypto.randomBytes(32).toString('hex')`.

### 3.4 Rate limiting manquant sur plusieurs endpoints

- **Severite : MOYENNE**

| Endpoint                         | Risque                              |
| -------------------------------- | ----------------------------------- |
| `request-password-reset.post.ts` | Spam d'emails de reset              |
| `reset-password.post.ts`         | Brute force sur token               |
| `change-password.post.ts`        | Brute force sur mot de passe actuel |
| `check-email.post.ts`            | Enumeration d'emails                |
| `verify-reset-token.get.ts`      | Verification de token               |

---

## 4. Vulnerabilites basses

### 4.1 Salt rounds bcrypt inconsistant

- **Fichiers :** `register.post.ts:35`, `reset-password.post.ts:50`, `set-password-and-verify.post.ts:70` (salt = 10) vs `change-password.post.ts:62` (salt = 12)
- **Correction :** Harmoniser a 12 partout.

### 4.2 Tokens de reset non nettoyes en BDD

- **Description :** Les tokens sont marques `used: true` mais jamais supprimes. Pas de tache de nettoyage.
- **Correction :** Ajouter une tache planifiee de nettoyage.

### 4.3 Rate limiter en memoire

- **Fichier :** `server/utils/rate-limiter.ts`
- **Description :** `Map` en memoire avec nettoyage toutes les 10 minutes. En multi-instances, chaque instance a son propre compteur.
- **Correction :** Migrer vers Redis en production.

### 4.4 Fixation de session

- **Severite : FAIBLE**
- **Description :** Les sessions sont creees/remplacees a la connexion via `setUserSession()`. Le risque est faible grace aux cookies scelles mais l'absence de rotation explicite du cookie merite attention.

---

## 5. Points positifs

- Hachage bcrypt correct avec salt rounds raisonnables
- Validation de complexite des mots de passe via schema Zod (min 8 chars, majuscule, chiffre)
- Rate limiting en place sur login (5/min), register (3/h), resend-verification (3/15min)
- Tokens de reset robustes : `randomBytes(32)`, expiration configurable, usage unique
- Message generique au reset password (pas d'enumeration)
- Hash de mot de passe jamais expose dans les reponses API
- Deconnexion correcte avec `clearUserSession`
- CSP solide avec nonce + SRI
- Cookies OAuth avec `httpOnly`, `sameSite: 'lax'`, `secure` en prod, `maxAge: 600`
