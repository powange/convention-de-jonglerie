# Rapport d'audit de securite -- Upload de fichiers et exposition de donnees

**Date :** 13 avril 2026
**Perimetre :** Gestion des fichiers uploades, systeme de backup/restore, exposition de donnees sensibles, logs
**Derniere mise a jour :** 23 avril 2026

---

## 1. Vulnerabilites critiques

### 1.1 Injection de commandes OS dans le systeme de backup/restore

- **Fichiers :** `server/api/admin/backup/restore.post.ts`, `server/api/admin/backup/create.post.ts`
- **Severite : CRITIQUE**
- **Statut : CORRIGE**
- **Description :** Utilisation massive de `execSync()` avec des valeurs concatenees dans des commandes shell. La commande `mysql` etait construite avec le mot de passe en clair dans les arguments (visible dans `ps aux`).
- **Correction appliquee :**
  - `mysqldump` : `execFile` avec arguments en tableau + `MYSQL_PWD` en env var (password non visible dans `ps aux`)
  - `tar` : `execFile` avec arguments en tableau (pas d'injection shell possible)
  - `find` : remplace par fonction native recursive `findFirstSqlFile` (helper `fs/promises`)
  - `mysql` (restore) : `spawn` avec pipe stdin depuis le fichier SQL + `MYSQL_PWD`
  - `cp -r` : remplace par `fs.cp` natif avec `{ recursive: true }`
  - `rm` : remplace par `fs.unlink` natif

### 1.2 Path traversal dans backup download/delete/restore

- **Fichiers :** `server/api/admin/backup/download.get.ts`, `delete.delete.ts`, `restore.post.ts`
- **Severite : CRITIQUE** (attenuee par la protection admin)
- **Statut : CORRIGE**
- **Description :** Le parametre `filename` etait directement utilise dans `path.join(process.cwd(), 'backups', filename)`. La seule validation etait sur l'extension. `../../etc/passwd.sql` passait la validation.
- **Correction appliquee :** `path.basename(filename)` dans les 3 fichiers pour ne garder que le nom de fichier, rendant le path traversal impossible.

---

## 2. Vulnerabilites hautes

### 2.1 Absence de validation MIME/extension sur les uploads

- **Fichiers :**
  - `server/api/files/edition.post.ts`
  - `server/api/files/convention.post.ts`
  - `server/api/files/profile.post.ts`
  - `server/api/files/generic.post.ts`
  - `server/api/files/lost-found.post.ts`
  - `server/api/files/show.post.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Aucun de ces endpoints ne validait le type MIME ou l'extension. Un utilisateur authentifie pouvait uploader un `.html`, `.js`, `.php` ou tout autre type arbitraire.
- **Correction appliquee :** Helper centralise `validateUploadedFile()` dans `server/utils/upload-validation.ts` :
  - Whitelist MIME : `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - Whitelist extensions : `jpg`, `jpeg`, `png`, `webp`, `gif`
  - Taille max configurable (defaut 10 MB)
  - Appele dans les 6 endpoints d'upload AVANT `storeFileLocally()`

### 2.2 Route de service de fichiers sans protection path traversal

- **Fichier :** `server/routes/uploads/[...path].get.ts`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** Contrairement a `server/api/uploads/[...path].get.ts` qui avait une protection complete, cette route n'avait aucune verification.
- **Correction appliquee :** Ajout des memes protections : verification de `..` et `//`, verification `startsWith(uploadDir)`, et protection sur le fallback `public/uploads`.

### 2.3 Injection SQL via restauration de backup

- **Fichier :** `server/api/admin/backup/restore.post.ts`
- **Severite : HAUTE**
- **Statut : NON TRAITE** (risque assume)
- **Description :** Le contenu SQL du fichier de restauration est execute directement sans validation. Un backup malveillant pourrait contenir `DROP DATABASE`, `CREATE USER`, etc.
- **Decision :** L'endpoint est protege par `requireGlobalAdminWithDbCheck` (super-admin uniquement). Le risque est considere comme acceptable car le super-admin est par nature autorise a executer du SQL arbitraire (il a aussi acces a la BDD directement). Validation basique du contenu SQL non ajoutee car elle serait trivialement contournable et donnerait une fausse impression de securite.

---

## 3. Vulnerabilites moyennes

### 3.1 Logs excessifs avec donnees debug en production

- **Fichiers :**
  - `server/api/files/profile.post.ts` (logs cles de l'objet fichier)
  - `server/api/files/convention.post.ts` (`console.log('Received files:', files)` -- contenu base64)
  - `server/api/files/edition.post.ts` (logs files count + storage)
  - `server/api/editions/[id]/ticketing/helloasso/orders.get.ts` (statut Client Secret)
  - `server/api/admin/tasks/[taskName].post.ts` (email de l'admin)
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Correction appliquee :** Suppression des `console.log` debug. L'audit log de tasks admin garde seulement `user #id` (sans email).

### 3.2 Exposition d'email dans `userWithGravatarSelect`

- **Fichier :** `server/utils/prisma-select-helpers.ts`
- **Severite : MOYENNE**
- **Statut : NON TRAITE** (risque mineur)
- **Description :** Le select inclut `email` en plus de `emailHash`. Le `emailHash` seul suffit pour Gravatar.
- **Decision :** Le helper n'est utilise que dans des contextes ou l'email est deja accessible (organisateurs d'une convention, admins). Refactoring possible mais non prioritaire.

### 3.3 Configuration `xssValidator: false` et `rateLimiter: false`

- **Fichier :** `nuxt.config.ts`
- **Severite : MOYENNE**
- **Statut : ACCEPTE** (defense en profondeur assuree par d'autres mecanismes)
- **Description :** Le validateur XSS et le limiteur de taux de `nuxt-security` sont desactives.
- **Decision :**
  - **`xssValidator: false`** : desactive volontairement pour ne pas bloquer les contenus utilisateur legitimes (markdown, descriptions, posts). La defense XSS est assuree par : CSP stricte (nonce + strict-dynamic), `sanitizeUserContent()` cote serveur, `rehype-sanitize` pour markdown, echappement Vue.js par defaut.
  - **`rateLimiter: false`** : remplace par notre rate limiter custom (`server/utils/rate-limiter.ts`) plus granulaire et configure par endpoint critique.

---

## Resume des corrections

| #   | Faille                                        | Severite | Statut                     |
| --- | --------------------------------------------- | -------- | -------------------------- |
| 1.1 | Injection commandes OS dans backup/restore    | CRITIQUE | CORRIGE                    |
| 1.2 | Path traversal backup download/delete/restore | CRITIQUE | CORRIGE                    |
| 2.1 | Validation MIME/extension uploads             | HAUTE    | CORRIGE                    |
| 2.2 | Path traversal route uploads                  | HAUTE    | CORRIGE                    |
| 2.3 | Injection SQL via restore backup              | HAUTE    | NON TRAITE (risque assume) |
| 3.1 | Logs debug en production                      | MOYENNE  | CORRIGE                    |
| 3.2 | Email expose dans userWithGravatarSelect      | MOYENNE  | NON TRAITE (mineur)        |
| 3.3 | xssValidator / rateLimiter desactives         | MOYENNE  | ACCEPTE                    |

**Score : 5 corrigees / 1 acceptee / 2 non traitees (risques assumes/mineurs)**

---

## Points positifs

- Fichiers `.env` correctement exclus de Git et Docker
- Selects Prisma bien limites (pas de `select *` implicite)
- CSP et SRI en place
- Authentification admin (`requireGlobalAdminWithDbCheck`) sur tous les endpoints de backup
- Protection path traversal sur toutes les routes de fichiers (api + routes)
- Validation MIME/extension/taille centralisee sur tous les uploads
- Mot de passe BDD jamais expose dans `ps aux` (`MYSQL_PWD` env var)
- Aucun `execSync` avec interpolation shell
- Secrets masques avec `***SET***` dans `server/api/admin/config.get.ts`
