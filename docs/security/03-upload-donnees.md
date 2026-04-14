# Rapport d'audit de securite -- Upload de fichiers et exposition de donnees

**Date :** 13 avril 2026
**Perimetre :** Gestion des fichiers uploades, systeme de backup/restore, exposition de donnees sensibles, logs

---

## 1. Vulnerabilites critiques

### 1.1 Injection de commandes OS dans le systeme de backup/restore

- **Fichiers :** `server/api/admin/backup/restore.post.ts` (lignes 50, 94, 155, 186), `server/api/admin/backup/create.post.ts` (lignes 62, 94, 96, 102, 107)
- **Severite : CRITIQUE**
- **Description :** Utilisation massive de `execSync()` avec des valeurs concatenees dans des commandes shell :
  ```typescript
  execSync(`tar -xzf "${tempArchivePath}" -C "${tempExtractDir}"`)
  execSync(`cp -r "${extractedUploadsPath}"/* "${uploadsDestPath}"/`)
  ```
  La commande `mysql` est construite avec le mot de passe en clair dans les arguments :
  ```typescript
  const mysqlCmd = ['mysql', `-h${dbHost}`, `-p${dbPassword}`, dbName, `< ${tempFilePath}`].join(
    ' '
  )
  execSync(mysqlCmd)
  ```
- **Impact :** Un admin malveillant pourrait injecter des commandes via un nom de fichier forge. Le mot de passe BDD est visible dans `ps aux`.
- **Attenuation :** Seuls les super-admins ont acces.
- **Correction :** Utiliser `execFile`/`spawn` avec arguments en tableau. Pour MySQL, utiliser un fichier `.my.cnf` temporaire.

### 1.2 Path traversal dans backup download/delete/restore

- **Fichiers :** `server/api/admin/backup/download.get.ts:22`, `delete.delete.ts:22`, `restore.post.ts:86`
- **Severite : CRITIQUE** (attenuee par la protection admin)
- **Description :** Le parametre `filename` est directement utilise dans `path.join(process.cwd(), 'backups', filename)`. La seule validation est sur l'extension. `../../etc/passwd.sql` passerait la validation.
- **Correction :** Ajouter `path.basename(filename)` ou verifier que le chemin resolu reste dans `backups/`.

---

## 2. Vulnerabilites hautes

### 2.1 Absence de validation MIME/extension sur les uploads

- **Fichiers :**
  - `server/api/files/edition.post.ts`
  - `server/api/files/convention.post.ts`
  - `server/api/files/profile.post.ts`
  - `server/api/files/generic.post.ts`
  - `server/api/files/lost-found.post.ts`
- **Severite : HAUTE**
- **Description :** Aucun de ces endpoints ne valide le type MIME ou l'extension. Un utilisateur authentifie pourrait uploader un `.html`, `.js`, `.php` ou tout autre type arbitraire.
- **Note :** Seul `downloadAndStoreImage()` dans `server/utils/file-helpers.ts` valide les types MIME (`ALLOWED_IMAGE_TYPES`), mais uniquement pour les telechargements depuis des URL externes.
- **Correction :** Ajouter une validation MIME (whitelist `image/jpeg`, `image/png`, `image/webp`, `image/gif`) et d'extension dans chaque endpoint ou dans un middleware centralise.

### 2.2 Route de service de fichiers sans protection path traversal

- **Fichier :** `server/routes/uploads/[...path].get.ts`
- **Severite : HAUTE**
- **Description :** Contrairement a `server/api/uploads/[...path].get.ts` qui a une protection complete (verification de `..`, `//`, et `startsWith`), cette route n'a aucune verification.
- **Correction :** Ajouter les memes verifications ou supprimer cette route doublon (commentaire "ancien systeme" present).

### 2.3 Injection SQL via restauration de backup

- **Fichier :** `server/api/admin/backup/restore.post.ts`
- **Severite : HAUTE**
- **Description :** Le contenu SQL du fichier de restauration est execute directement sans validation. Un backup malveillant pourrait contenir `DROP DATABASE`, `CREATE USER`, etc.
- **Correction :** Ajouter une validation basique du contenu SQL et journaliser l'action.

---

## 3. Vulnerabilites moyennes

### 3.1 Logs excessifs avec donnees debug en production

- **Fichiers :**
  - `server/api/files/profile.post.ts` (lignes 53-56) : log les cles de l'objet fichier
  - `server/api/files/convention.post.ts` (lignes 20-21, 31) : `console.log('Received files:', files)` -- log potentiellement le contenu base64 complet
  - `server/api/editions/[id]/ticketing/helloasso/orders.get.ts` (ligne 45) : log le statut du Client Secret
  - `server/api/admin/tasks/[taskName].post.ts` (ligne 27) : log l'email de l'admin
- **Correction :** Conditionner avec `process.env.NODE_ENV === 'development'` ou utiliser un logger avec niveaux.

### 3.2 Exposition d'email dans `userWithGravatarSelect`

- **Fichier :** `server/utils/prisma-select-helpers.ts` (lignes 74-80)
- **Description :** Inclut `email` en plus de `emailHash`. Le `emailHash` seul suffit pour Gravatar.
- **Correction :** Supprimer `email` de ce select et creer un select separe pour les contextes admin.

### 3.3 Configuration `xssValidator: false` et `rateLimiter: false`

- **Fichier :** `nuxt.config.ts` (lignes 125-126)
- **Description :** Le validateur XSS et le limiteur de taux de `nuxt-security` sont desactives.
- **Correction :** Reactiver ou configurer des exceptions plutot que de desactiver globalement.

---

## 4. Points positifs

- Fichiers `.env` correctement exclus de Git et Docker
- Selects Prisma bien limites (pas de `select *` implicite)
- CSP et SRI en place
- Authentification admin (`requireGlobalAdminWithDbCheck`) sur tous les endpoints de backup
- Protection path traversal correcte sur `server/api/uploads/[...path].get.ts`
- Secrets masques avec `***SET***` dans `server/api/admin/config.get.ts`
