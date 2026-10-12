<script setup lang="ts">
/**
 * `/register` n'est plus une page : elle redirige vers `/login` — constat C6.
 *
 * ## Ce que mesurait l'état d'avant
 *
 * C'était une **seconde** page d'inscription, 411 lignes, avec son propre champ d'adresse et son
 * propre appel à `/api/auth/register`. Et :
 *
 * - **rien dans l'interface n'y menait** : aucune occurrence hors d'une liste de pages d'auth, du
 *   préchargement de traductions et de deux commentaires. Elle était exclue du sitemap ;
 * - **aucun courriel n'y renvoyait** : l'activation d'un compte créé par un organisateur passe
 *   par `/login`, et la spécification Playwright qui la couvre aussi. Le commentaire de
 *   `check-email.post.ts` qui parle du « claim via /register » désigne le POINT D'API, pas la
 *   page ;
 * - elle n'appelait **pas** `check-email`, contrairement au parcours de `/login`.
 *
 * ## 📍 CE QUI A TRANCHÉ, et que j'avais d'abord mesuré DE TRAVERS
 *
 * J'avais retenu contre sa suppression qu'elle offrait les trois catégories de profil (bénévole,
 * artiste, organisateur), que `/login` ne transmet pas. **C'était faux** : après validation de son
 * adresse, `verify-email` redirige vers `/welcome/categories`, qui pose exactement ces trois
 * catégories — avec un « passer ». Les DEUX parcours d'inscription finissent sur `/verify-email`,
 * donc les deux les proposent ; `/register` les demandait seulement plus tôt.
 *
 * Vérifier **une** moitié du parcours ne dit rien de l'autre. La suppression ne retire donc rien.
 *
 * ## Pourquoi une redirection plutôt qu'une suppression du fichier
 *
 * Les adresses déjà en circulation — un favori, un lien collé dans une conversation — doivent
 * continuer de mener quelque part. `redirect` dans `definePageMeta` vaut pour le rendu serveur
 * **et** pour une navigation interne, là où une règle de route Nitro ne couvrirait que le premier.
 */
definePageMeta({
  // Temporaire (302 par défaut) et non permanente : une redirection permanente est mise en cache
  // par le navigateur, et rétablir la page ensuite ne suffirait plus à la rendre atteignable.
  redirect: '/login',
})
</script>

<template>
  <div />
</template>
