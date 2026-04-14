# Synthese de l'audit de securite

**Projet :** Convention de Jonglerie
**Date :** 13 avril 2026
**Perimetres audites :** API backend, Authentification & sessions, Upload & donnees, XSS & frontend
**Derniere mise a jour :** 14 avril 2026

---

## Vue d'ensemble

L'application presente une **architecture de securite globalement solide** : middleware d'authentification centralise, double verification admin (session + BDD), validation Zod generalisee, CSP bien configuree, cookies scelles pour les sessions. Cependant, **plusieurs failles significatives** ont ete identifiees, dont certaines critiques.

**Progression des corrections :** 10 failles du rapport API Backend corrigees sur 12 (dont 1 partielle).

---

## Tableau recapitulatif par severite

### CRITIQUE (3 failles)

| #   | Faille                                                       | Fichier(s)                                                  | Rapport                                  | Statut     |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------- | ---------- |
| C1  | Cookie d'impersonation non signe -- escalade de privileges   | `server/utils/impersonation-helpers.ts`                     | [API Backend](01-api-backend.md)         | CORRIGE    |
| C2  | Injection de commandes OS via `execSync` dans backup/restore | `server/api/admin/backup/create.post.ts`, `restore.post.ts` | [Upload & Donnees](03-upload-donnees.md) | A CORRIGER |
| C3  | `NUXT_SESSION_PASSWORD` potentiellement vide                 | `nuxt.config.ts:381`                                        | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER |

### HAUTE (8 failles)

| #   | Faille                                                        | Fichier(s)                                                                 | Rapport                                                          | Statut     |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| H1  | Path traversal dans backup download/delete/restore            | `server/api/admin/backup/download.get.ts`, `delete.delete.ts`              | [API Backend](01-api-backend.md), [Upload](03-upload-donnees.md) | CORRIGE    |
| H2  | Path traversal route uploads sans protection                  | `server/routes/uploads/[...path].get.ts`                                   | [API Backend](01-api-backend.md), [Upload](03-upload-donnees.md) | CORRIGE    |
| H3  | Endpoints admin sans verification BDD du statut admin         | `admin/conventions/[id].delete.ts`, `admin/users/[id]/impersonate.post.ts` | [API Backend](01-api-backend.md)                                 | CORRIGE    |
| H4  | Pas d'invalidation des sessions au changement de mot de passe | `change-password.post.ts`, `reset-password.post.ts`                        | [Auth & Sessions](02-auth-sessions.md)                           | A CORRIGER |
| H5  | Brute force possible sur codes de verification 6 chiffres     | `verify-email.post.ts`, `set-password-and-verify.post.ts`                  | [Auth & Sessions](02-auth-sessions.md)                           | CORRIGE    |
| H6  | `Math.random()` pour generation de codes de securite          | `server/utils/emailService.ts:118`, `claim.post.ts:48`                     | [Auth & Sessions](02-auth-sessions.md)                           | A CORRIGER |
| H7  | Aucune validation MIME/extension sur les uploads              | `server/api/files/*.post.ts`                                               | [Upload & Donnees](03-upload-donnees.md)                         | A CORRIGER |
| H8  | XSS via `document.write` sans echappement (export PDF)        | `app/components/volunteers/TimeSlotsList.vue`                              | [XSS & Frontend](04-xss-frontend.md)                             | A CORRIGER |

### MOYENNE (10 failles)

| #   | Faille                                                                   | Fichier(s)                                                                                               | Rapport                                  | Statut          |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------- |
| M1  | Aucune protection CSRF implementee                                       | Tous les endpoints POST/PUT/DELETE                                                                       | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER      |
| M2  | Open Redirect sur les routes OAuth (`returnTo`)                          | `server/routes/auth/google.get.ts`, `facebook.get.ts`                                                    | [XSS & Frontend](04-xss-frontend.md)     | A CORRIGER      |
| M3  | `Math.random()` pour tokens OAuth state                                  | `google.get.ts:42`, `facebook.get.ts:42`                                                                 | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER      |
| M4  | Enumeration d'emails via `check-email` sans rate limiting                | `check-email.post.ts`                                                                                    | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M5  | Rate limiting manquant sur 5 endpoints auth                              | `request-password-reset`, `reset-password`, `verify-email`, `set-password-and-verify`, `change-password` | [Auth & Sessions](02-auth-sessions.md)   | CORRIGE         |
| M6  | Sanitisation XSS manquante sur contenus stockes (commentaires, messages) | `commentsHandler.ts`, `messages/index.post.ts`                                                           | [API Backend](01-api-backend.md)         | CORRIGE         |
| M7  | ~33 endpoints sans validation Zod                                        | Divers `server/api/`                                                                                     | [API Backend](01-api-backend.md)         | PARTIEL (3/~33) |
| M8  | Controle d'acces manquant sur creation de posts                          | `editions/[id]/posts/index.post.ts`                                                                      | [API Backend](01-api-backend.md)         | CORRIGE         |
| M9  | Credentials HelloAsso transitant par le navigateur                       | `ticketing/helloasso/orders.post.ts`                                                                     | [API Backend](01-api-backend.md)         | A CORRIGER      |
| M10 | Logs excessifs avec donnees debug en production                          | `files/profile.post.ts`, `files/convention.post.ts`                                                      | [Upload & Donnees](03-upload-donnees.md) | A CORRIGER      |

### BASSE (7 failles)

| #   | Faille                                                | Fichier(s)                                   | Rapport                                  | Statut     |
| --- | ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ---------- |
| B1  | Salt rounds bcrypt inconsistant (10 vs 12)            | `register.post.ts`, `reset-password.post.ts` | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER |
| B2  | Tokens de reset non nettoyes en BDD                   | `request-password-reset.post.ts`             | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER |
| B3  | Rate limiter en memoire (pas Redis)                   | `server/utils/rate-limiter.ts`               | [Auth & Sessions](02-auth-sessions.md)   | A CORRIGER |
| B4  | Bug `deleteCommentForEntity` -- mauvais modele Prisma | `server/utils/commentsHandler.ts`            | [API Backend](01-api-backend.md)         | CORRIGE    |
| B5  | Fonction `requireSuperAdmin` inexistante              | `admin/notifications/test-firebase.post.ts`  | [API Backend](01-api-backend.md)         | CORRIGE    |
| B6  | Donnees utilisateur en localStorage (non-secret)      | `app/stores/auth.ts`                         | [XSS & Frontend](04-xss-frontend.md)     | A CORRIGER |
| B7  | `xssValidator: false` dans nuxt-security              | `nuxt.config.ts`                             | [Upload & Donnees](03-upload-donnees.md) | A CORRIGER |

---

## Progression globale

| Severite  | Total  | Corrigees | Partielles | Restantes |
| --------- | ------ | --------- | ---------- | --------- |
| CRITIQUE  | 3      | 1         | 0          | 2         |
| HAUTE     | 8      | 4         | 0          | 4         |
| MOYENNE   | 10     | 4         | 1          | 5         |
| BASSE     | 7      | 2         | 0          | 5         |
| **Total** | **28** | **11**    | **1**      | **16**    |

---

## Priorites de correction restantes

### Immediat (P0) -- A corriger avant tout deploiement

1. ~~**C1** -- Signer/chiffrer le cookie d'impersonation~~ CORRIGE
2. **C2** -- Remplacer `execSync` par `execFile`/`spawn` dans le systeme de backup
3. **C3** -- Ajouter un guard au demarrage pour `NUXT_SESSION_PASSWORD`
4. ~~**H1/H2** -- Corriger les path traversal (backup + route uploads)~~ CORRIGE

### Court terme (P1) -- Dans la semaine

5. ~~**H3** -- Utiliser `requireGlobalAdminWithDbCheck` sur tous les endpoints admin~~ CORRIGE
6. **H6** -- Remplacer `Math.random()` par `crypto.randomInt()`/`crypto.randomBytes()`
7. ~~**H5/M5** -- Ajouter rate limiting sur les endpoints d'auth manquants~~ CORRIGE
8. **H7** -- Ajouter validation MIME/extension sur les uploads
9. **H8** -- Echapper les donnees dans `exportToPdf()` de `TimeSlotsList.vue`

### Moyen terme (P2) -- Dans le mois

10. **H4** -- Implementer l'invalidation de sessions au changement de mot de passe
11. **M1** -- Implementer une protection CSRF
12. **M2** -- Valider le `returnTo` OAuth (chemin relatif uniquement)
13. ~~**M6/M7** -- Sanitisation XSS serveur~~ CORRIGE ~~+ migration vers Zod~~ PARTIEL
14. ~~**M8** -- Ajouter controle d'acces sur la creation de posts~~ CORRIGE

---

## Points positifs

- Middleware d'authentification centralise avec liste declarative de routes publiques
- Double verification admin (session + BDD) sur tous les endpoints admin (corrige)
- Validation Zod generalisee (~129/159 endpoints, ameliore)
- Protection IDOR systematique via `requireResourceOwner`
- CSP solide avec nonce + SRI
- Webhook Stripe avec verification de signature
- Pas d'injection SQL (Prisma template literals)
- Mots de passe hashes avec bcrypt
- Tokens de reset robustes (256 bits, expiration, usage unique)
- Rate limiting sur tous les endpoints d'authentification (corrige)
- Sanitisation XSS sur les contenus utilisateur stockes (corrige)
- Cookie d'impersonation chiffre et signe (corrige)
- Protection path traversal sur toutes les routes de fichiers (corrige)

---

## Rapports detailles

- [01 -- API Backend](01-api-backend.md)
- [02 -- Authentification & Sessions](02-auth-sessions.md)
- [03 -- Upload & Donnees](03-upload-donnees.md)
- [04 -- XSS & Frontend](04-xss-frontend.md)
