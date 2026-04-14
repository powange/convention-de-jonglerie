# Rapport d'audit de securite -- XSS et securite frontend

**Date :** 13 avril 2026
**Perimetre :** Vulnerabilites cote client (XSS, injection, stockage, CSP, open redirect)

---

## 1. Vulnerabilite haute

### 1.1 XSS via `document.write` dans l'export PDF

- **Fichier :** `app/components/volunteers/TimeSlotsList.vue` (lignes 226-397)
- **Severite : HAUTE**
- **Description :** La fonction `exportToPdf()` construit du HTML par concatenation de template literals et l'injecte via `printWindow.document.write(html)`. Les donnees suivantes sont injectees sans echappement :
  ```typescript
  ${slot.title}
  ${slot.team?.name}
  ${slot.description}
  ${props.editionName}
  ${props.volunteerName}
  ```
- **Vecteur d'attaque :** XSS stocke. Un organisateur malveillant cree un creneau avec un titre contenant du JavaScript (`<img src=x onerror="alert(document.cookie)">`), et tout benevole qui exporte en PDF declenche le payload.
- **Correction :** Creer et appliquer une fonction `escapeHtml()` a toutes les interpolations :
  ```typescript
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  ```

---

## 2. Vulnerabilite moyenne

### 2.1 Open Redirect sur les routes OAuth

- **Fichiers :** `server/routes/auth/google.get.ts` (lignes 237-239), `server/routes/auth/facebook.get.ts` (lignes 214-217)
- **Severite : MOYENNE**
- **Description :** La validation du `returnTo` se limite a :
  ```typescript
  returnTo && !returnTo.includes('/login') && !returnTo.includes('/auth/') ? returnTo : '/'
  ```
  Cette validation est insuffisante :
  - `returnTo=https://evil.com` (URL absolue externe) passerait
  - `returnTo=//evil.com` (protocol-relative URL) passerait
  - `returnTo=/login-phishing` passerait (ne contient pas `/login` exact)
- **Impact :** Phishing post-authentification OAuth.
- **Correction :**
  ```typescript
  const isRelativePath = returnTo.startsWith('/') && !returnTo.startsWith('//')
  const finalRedirect =
    returnTo && isRelativePath && !returnTo.includes('/login') && !returnTo.includes('/auth/')
      ? returnTo
      : '/'
  ```

---

## 3. Vulnerabilites basses / Info

### 3.1 `xssValidator: false` dans nuxt-security

- **Fichier :** `nuxt.config.ts` (ligne 126)
- **Severite : FAIBLE**
- **Description :** Le validateur XSS est desactive. La protection est assuree par d'autres mecanismes (CSP, sanitisation markdown).

### 3.2 Donnees utilisateur en localStorage

- **Fichier :** `app/stores/auth.ts` (ligne 59)
- **Severite : FAIBLE**
- **Description :** L'objet utilisateur (email, pseudo, nom, prenom, phone, roles) est stocke dans `localStorage` sous `authUser`. C'est purement UX (cache local). Les donnees ne sont pas des secrets.
- **Autres donnees en localStorage (non sensibles) :** `pwa-dismissed`, `calendar-current-date`, `device-id`, brouillon de candidature artiste.

### 3.3 npm audit non execute

- **Severite : INFO**
- **Recommandation :** Executer regulierement `npm audit` et integrer `npm audit --audit-level=high` dans le pipeline CI.

---

## 4. Points positifs

### Utilisation de `v-html` -- Correcte (30 occurrences)

Toutes les utilisations de `v-html` passent par `markdownToHtml()` qui utilise **rehype-sanitize** avec un schema de whitelist strict :

```
remarkParse -> remarkGfm -> remarkRehype -> rehypeExternalLinks -> rehypeSanitize -> rehypeStringify
```

Fichiers concernes (tous correctement sanitises) :

- `MinimalMarkdownEditor.vue`
- `edition/Header.vue`
- `editions/[id]/index.vue`
- `editions/[id]/artist-space.vue`
- `editions/[id]/volunteers/index.vue`
- Pages shows-call (apply, index)
- Pages gestion (artists, volunteers)

### Pas de `eval()` ni `new Function()`

Aucune occurrence trouvee dans le code applicatif.

### `innerHTML` uniquement dans les tests

Seule occurrence dans `test/nuxt/utils/renderPage.ts`.

### CSP solide

- `nonce: true` + `sri: true` (Subresource Integrity)
- `script-src: 'self' 'strict-dynamic' 'nonce-{{nonce}}'`
- `base-uri: 'none'`, `object-src: 'none'`, `script-src-attr: 'none'`
- `upgrade-insecure-requests: true`
- `'unsafe-inline'` present mais ignore par les navigateurs modernes grace a `'strict-dynamic'` + nonce (CSP Level 3)

### Cookies de session securises

Cookies scelles via `nuxt-auth-utils`. Cookies OAuth temporaires avec `httpOnly: true`, `sameSite: 'lax'`, `secure: true` en production, `maxAge: 600`.

### Pas de CSRF via `SameSite=Lax`

Les cookies de session utilisent `SameSite=Lax`, ce qui protege contre les attaques CSRF basiques sur les requetes POST cross-origin.
