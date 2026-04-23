# Rapport d'audit de securite -- XSS et securite frontend

**Date :** 13 avril 2026
**Perimetre :** Vulnerabilites cote client (XSS, injection, stockage, CSP, open redirect)
**Derniere mise a jour :** 23 avril 2026

---

## 1. Vulnerabilite haute

### 1.1 XSS via `document.write` dans l'export PDF

- **Fichier :** `app/components/volunteers/TimeSlotsList.vue`
- **Severite : HAUTE**
- **Statut : CORRIGE**
- **Description :** La fonction `exportToPdf()` construisait du HTML par concatenation de template literals et l'injectait via `printWindow.document.write(html)`. Les donnees `slot.title`, `slot.team?.name`, `slot.description`, `props.editionName`, `props.volunteerName` etaient injectees sans echappement.
- **Vecteur d'attaque :** XSS stocke. Un organisateur malveillant creait un creneau avec un titre contenant du JavaScript (`<img src=x onerror="alert(document.cookie)">`), et tout benevole qui exportait en PDF declenchait le payload.
- **Correction appliquee :**
  - Helper `escapeHtml()` qui echappe `&`, `<`, `>`, `"`, `'` -- applique a toutes les interpolations UGC
  - Helper `sanitizeColor()` qui valide que la couleur d'equipe est un format hex strict (anti-injection CSS)
  - `delayMinutes` casse en `Number()` pour eviter toute interpolation arbitraire

---

## 2. Vulnerabilite moyenne

### 2.1 Open Redirect sur les routes OAuth

- **Fichiers :** `server/routes/auth/google.get.ts`, `server/routes/auth/facebook.get.ts`
- **Severite : MOYENNE**
- **Statut : CORRIGE**
- **Description :** La validation du `returnTo` etait insuffisante :
  - `returnTo=https://evil.com` (URL absolue externe) passait
  - `returnTo=//evil.com` (protocol-relative URL) passait
  - `returnTo=/login-phishing` passait (ne contient pas `/login` exact)
- **Impact :** Phishing post-authentification OAuth.
- **Correction appliquee :** Helper centralise `sanitizeReturnTo()` dans `server/utils/safe-redirect.ts` :
  - Rejette les URL absolues (http://, https://, //evil.com)
  - Rejette les chemins contenant `\\` (interprete comme `/` par certains navigateurs)
  - Rejette les pages d'authentification (`/login`, `/auth/*`)
  - Fallback vers `/` si invalide

---

## 3. Vulnerabilites basses / Info

### 3.1 `xssValidator: false` dans nuxt-security

- **Fichier :** `nuxt.config.ts`
- **Severite : FAIBLE**
- **Statut : ACCEPTE**
- **Description :** Le validateur XSS est desactive volontairement pour ne pas bloquer les contenus utilisateur legitimes (markdown, descriptions, posts).
- **Decision :** La defense XSS est assuree par plusieurs mecanismes complementaires :
  - **CSP stricte** (nonce + strict-dynamic + base-uri none + object-src none)
  - **Sanitisation serveur** des contenus stockes via `sanitizeUserContent()` (commentaires, messages, posts, bookings)
  - **Sanitisation markdown** via `rehype-sanitize` (whitelist stricte)
  - **Echappement Vue.js** par defaut sur l'interpolation `{{ }}`
  - **Echappement explicite** dans l'export PDF (`escapeHtml`)

### 3.2 Donnees utilisateur en localStorage

- **Fichier :** `app/stores/auth.ts`
- **Severite : FAIBLE**
- **Statut : ACCEPTE**
- **Description :** L'objet utilisateur (email, pseudo, nom, prenom, phone, roles) est stocke dans `localStorage` sous `authUser`. C'est purement UX (cache local pour eviter un flash non-authentifie au chargement).
- **Decision :** Aucun secret (token, mot de passe) n'est stocke. La protection contre les fuites repose sur la CSP qui empeche les scripts tiers d'acceder au DOM.
- **Autres donnees en localStorage (non sensibles) :** `pwa-dismissed`, `calendar-current-date`, `device-id`, brouillon de candidature artiste.

### 3.3 npm audit non execute

- **Severite : INFO**
- **Statut : NON TRAITE** (recommandation)
- **Recommandation :** Executer regulierement `npm audit` et integrer `npm audit --audit-level=high` dans le pipeline CI.

---

## Resume des corrections

| #   | Faille                              | Severite | Statut                      |
| --- | ----------------------------------- | -------- | --------------------------- |
| 1.1 | XSS via document.write export PDF   | HAUTE    | CORRIGE                     |
| 2.1 | Open Redirect routes OAuth          | MOYENNE  | CORRIGE                     |
| 3.1 | xssValidator desactive              | FAIBLE   | ACCEPTE                     |
| 3.2 | Donnees utilisateur en localStorage | FAIBLE   | ACCEPTE                     |
| 3.3 | npm audit non execute               | INFO     | NON TRAITE (recommandation) |

**Score : 2 corrigees / 2 acceptees / 1 recommandation**

---

## Points positifs

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

### Protection CSRF Double Submit Cookie

Au-dela de la protection partielle de `SameSite=Lax`, un middleware CSRF (`server/middleware/00.csrf.ts`) valide un header `x-csrf-token` correspondant a un cookie sur toutes les mutations. Le plugin client (`app/plugins/csrf.client.ts`) injecte automatiquement le header sur toutes les requetes via un wrapper `$fetch`.

### Echappement systematique dans l'export PDF

Helper `escapeHtml()` applique sur toutes les interpolations UGC dans `TimeSlotsList.vue::exportToPdf()`. Helper `sanitizeColor()` valide les couleurs au format hex strict (anti-injection CSS).
