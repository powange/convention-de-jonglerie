# Synthese de l'audit de securite

**Projet :** Convention de Jonglerie
**Date initiale :** 13 avril 2026
**Perimetres audites :** API backend, Authentification & sessions, Upload & donnees, XSS & frontend
**Derniere mise a jour :** 23 avril 2026

---

## Vue d'ensemble

L'audit de securite initial avait identifie **28 failles** reparties sur 4 perimetres. **Toutes les failles ont ete traitees** (corrigees, partiellement corrigees, ou explicitement acceptees apres analyse).

**Statut final : 28 / 28 failles traitees**

- 24 **corrigees**
- 1 **partiellement corrigee** (M7 -- chantier en continu)
- 3 **acceptees** apres analyse (B3, B6, B7 -- justifications dans les rapports detailles)

---

## Tableau recapitulatif par severite

### CRITIQUE (3 failles -- toutes corrigees)

| #   | Faille                                                       | Fichier(s)                                                  | Rapport                                  | Statut  |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------- | ------- |
| C1  | Cookie d'impersonation non signe -- escalade de privileges   | `server/utils/impersonation-helpers.ts`                     | [API Backend](01-api-backend.md)         | CORRIGE |
| C2  | Injection de commandes OS via `execSync` dans backup/restore | `server/api/admin/backup/create.post.ts`, `restore.post.ts` | [Upload & Donnees](03-upload-donnees.md) | CORRIGE |
| C3  | `NUXT_SESSION_PASSWORD` potentiellement vide                 | `nuxt.config.ts`, plugin `validate-config.ts`               | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE |

### HAUTE (8 failles -- toutes corrigees)

| #   | Faille                                                        | Fichier(s)                                                                 | Rapport                                                          | Statut  |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| H1  | Path traversal dans backup download/delete/restore            | `server/api/admin/backup/download.get.ts`, `delete.delete.ts`              | [API Backend](01-api-backend.md), [Upload](03-upload-donnees.md) | CORRIGE |
| H2  | Path traversal route uploads sans protection                  | `server/routes/uploads/[...path].get.ts`                                   | [API Backend](01-api-backend.md), [Upload](03-upload-donnees.md) | CORRIGE |
| H3  | Endpoints admin sans verification BDD du statut admin         | `admin/conventions/[id].delete.ts`, `admin/users/[id]/impersonate.post.ts` | [API Backend](01-api-backend.md)                                 | CORRIGE |
| H4  | Pas d'invalidation des sessions au changement de mot de passe | `change-password.post.ts`, `reset-password.post.ts`                        | [Auth & Sessions](02-auth-sessions.md)                           | CORRIGE |
| H5  | Brute force possible sur codes de verification 6 chiffres     | `verify-email.post.ts`, `set-password-and-verify.post.ts`                  | [Auth & Sessions](02-auth-sessions.md)                           | CORRIGE |
| H6  | `Math.random()` pour generation de codes de securite          | `server/utils/emailService.ts`, `claim.post.ts`                            | [Auth & Sessions](02-auth-sessions.md)                           | CORRIGE |
| H7  | Aucune validation MIME/extension sur les uploads              | `server/api/files/*.post.ts`                                               | [Upload & Donnees](03-upload-donnees.md)                         | CORRIGE |
| H8  | XSS via `document.write` sans echappement (export PDF)        | `app/components/volunteers/TimeSlotsList.vue`                              | [XSS & Frontend](04-xss-frontend.md)                             | CORRIGE |

### MOYENNE (10 failles -- 9 corrigees, 1 partielle)

| #   | Faille                                                                   | Fichier(s)                                                                                               | Rapport                                  | Statut          |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------- |
| M1  | Aucune protection CSRF implementee                                       | Middleware serveur + plugin client (Double Submit Cookie)                                                | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M2  | Open Redirect sur les routes OAuth (`returnTo`)                          | `server/routes/auth/google.get.ts`, `facebook.get.ts`                                                    | [XSS & Frontend](04-xss-frontend.md)     | CORRIGE         |
| M3  | `Math.random()` pour tokens OAuth state                                  | `google.get.ts`, `facebook.get.ts`                                                                       | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M4  | Enumeration d'emails via `check-email` sans rate limiting                | `check-email.post.ts`                                                                                    | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M5  | Rate limiting manquant sur 5 endpoints auth                              | `request-password-reset`, `reset-password`, `verify-email`, `set-password-and-verify`, `change-password` | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M6  | Sanitisation XSS manquante sur contenus stockes (commentaires, messages) | `commentsHandler.ts`, `messages/index.post.ts`                                                           | [API Backend](01-api-backend.md)         | CORRIGE         |
| M7  | ~33 endpoints sans validation Zod                                        | Divers `server/api/`                                                                                     | [API Backend](01-api-backend.md)         | PARTIEL (3/~33) |
| M8  | Controle d'acces manquant sur creation de posts                          | `editions/[id]/posts/index.post.ts`                                                                      | [API Backend](01-api-backend.md)         | CORRIGE         |
| M9  | Credentials HelloAsso transitant par le navigateur                       | `ticketing/helloasso/orders.post.ts`                                                                     | [API Backend](01-api-backend.md)         | CORRIGE         |
| M10 | Logs excessifs avec donnees debug en production                          | `files/profile.post.ts`, `files/convention.post.ts`                                                      | [Upload & Donnees](03-upload-donnees.md) | CORRIGE         |

### BASSE (7 failles -- 4 corrigees, 3 acceptees)

| #   | Faille                                                | Fichier(s)                                   | Rapport                                  | Statut                                |
| --- | ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| B1  | Salt rounds bcrypt inconsistant (10 vs 12)            | `register.post.ts`, `reset-password.post.ts` | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE                               |
| B2  | Tokens de reset non nettoyes en BDD                   | `request-password-reset.post.ts`             | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE                               |
| B3  | Rate limiter en memoire (pas Redis)                   | `server/utils/rate-limiter.ts`               | [Auth & Sessions](02-auth-sessions.md)   | ACCEPTE (mono-instance)               |
| B4  | Bug `deleteCommentForEntity` -- mauvais modele Prisma | `server/utils/commentsHandler.ts`            | [API Backend](01-api-backend.md)         | CORRIGE                               |
| B5  | Fonction `requireSuperAdmin` inexistante              | `admin/notifications/test-firebase.post.ts`  | [API Backend](01-api-backend.md)         | CORRIGE                               |
| B6  | Donnees utilisateur en localStorage (non-secret)      | `app/stores/auth.ts`                         | [XSS & Frontend](04-xss-frontend.md)     | ACCEPTE (non-secret)                  |
| B7  | `xssValidator: false` dans nuxt-security              | `nuxt.config.ts`                             | [Upload & Donnees](03-upload-donnees.md) | ACCEPTE (CSP + sanitization couvrent) |

---

## Decisions documentees (failles acceptees)

### B3 -- Rate limiter en memoire

Application deployee sur **une seule instance** en production. Le `Map` en memoire est suffisant. A migrer vers Redis (driver `@unjs/storage` ou `ioredis`) le jour ou un scaling horizontal sera mis en place.

### B6 -- Donnees utilisateur en localStorage

Le store `app/stores/auth.ts` cache les infos publiques de l'utilisateur connecte (email, pseudo, nom, prenom, phone, roles) dans `localStorage` pour eviter un flash non-authentifie au chargement. **Aucun secret** (token, mot de passe) n'est stocke. La protection contre les fuites repose sur la CSP qui empeche les scripts tiers d'acceder au DOM.

### B7 -- `xssValidator: false` dans nuxt-security

Le validateur XSS de `nuxt-security` est desactive volontairement pour ne pas bloquer les contenus utilisateur legitimes (markdown, descriptions, posts). La defense en profondeur est assuree par :

- **CSP stricte** (nonce + strict-dynamic + base-uri none + object-src none)
- **Sanitisation serveur** des contenus stockes via `sanitizeUserContent()` (M6)
- **Sanitisation markdown** via `rehype-sanitize` avec whitelist
- **Echappement Vue.js** par defaut sur l'interpolation `{{ }}`

---

## M7 -- Validation Zod (chantier continu)

3 des ~33 endpoints sans Zod ont ete corriges (les plus critiques : carpool bookings, fcm subscribe, lost-found). Les ~30 restants ne sont pas des failles bloquantes : ce sont des endpoints internes ou bien proteges par d'autres mecanismes. Migration progressive recommandee a l'occasion d'autres modifications de ces fichiers.

---

## Points positifs (post-corrections)

- Cookie d'impersonation chiffre/signe (`useSession` h3) -- **CORRIGE C1**
- Guard au demarrage qui rejette une `NUXT_SESSION_PASSWORD` vide ou < 32 chars -- **CORRIGE C3**
- Protection CSRF Double Submit Cookie sur toutes les mutations -- **CORRIGE M1**
- Path traversal impossible (`path.basename` + verifications `..`/`//` + `startsWith`)
- Tous les endpoints admin verifient le statut en BDD via `requireGlobalAdminWithDbCheck`
- Rate limiting sur tous les endpoints d'auth sensibles (avec rate limiters dedies par cas d'usage)
- Validation MIME/extension/taille centralisee sur tous les uploads (`validateUploadedFile`)
- `crypto.randomBytes` / `crypto.randomInt` utilises partout (plus de `Math.random()` pour la securite)
- Sanitisation XSS systematique sur tous les contenus utilisateur stockes
- `execFile`/`spawn` avec arguments en tableau (plus de `execSync` avec interpolation shell)
- `MYSQL_PWD` env var (plus d'exposition du mot de passe BDD dans `ps aux`)
- Echappement HTML dans l'export PDF des plannings benevoles
- Validation stricte du `returnTo` OAuth (helper `sanitizeReturnTo`)
- Salt bcrypt harmonise a 12 sur tous les endpoints d'auth
- Tokens de reset password supprimes apres usage (deleteMany sur tous les tokens du user)
- CSP solide avec nonce + SRI
- Webhook Stripe avec verification de signature (exempte CSRF en consequence)
- Pas d'injection SQL (Prisma template literals + `Prisma.join`)
- Tous les credentials HelloAsso charges cote serveur depuis BDD chiffree (sauf test endpoint qui valide de nouveaux credentials)

---

## Rapports detailles

- [01 -- API Backend](01-api-backend.md)
- [02 -- Authentification & Sessions](02-auth-sessions.md)
- [03 -- Upload & Donnees](03-upload-donnees.md)
- [04 -- XSS & Frontend](04-xss-frontend.md)
