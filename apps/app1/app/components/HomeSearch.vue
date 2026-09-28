<template>
  <!--
    La loupe ne s'affiche que sur l'accueil : ce qu'elle recharge, c'est la liste de cette page.
    Ailleurs, elle n'aurait rien à filtrer.
  -->
  <div v-if="surAccueil" :class="ouvert ? 'w-full' : ''">
    <UInput
      v-if="ouvert"
      :model-value="terme"
      autofocus
      icon="i-heroicons-magnifying-glass"
      :placeholder="$t('homepage.search_placeholder')"
      size="sm"
      class="w-full"
      @update:model-value="rechercher"
      @keydown.escape="fermer"
    >
      <!--
        La seule croix de ce composant. `type="search"` en ajouterait une deuxième, celle du
        navigateur, qui ne fait qu'effacer le texte : deux croix côte à côte, aux effets
        différents. D'où un `type` par défaut et cette croix-ci, qui efface ET referme.
      -->
      <template #trailing>
        <UButton
          icon="i-heroicons-x-mark"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="$t('common.close')"
          @click="fermer"
        />
      </template>
    </UInput>

    <!--
      `title` et non `UTooltip`, comme le bouton de messagerie voisin : l'infobulle de Nuxt UI
      exige un `UApp` ancêtre, que l'application fournit mais qu'un test de composant isolé n'a
      pas — le composant devenait intestable pour un libellé au survol.
    -->
    <UButton
      v-else
      icon="i-heroicons-magnifying-glass"
      size="sm"
      color="neutral"
      variant="ghost"
      :title="$t('homepage.search_editions')"
      :aria-label="$t('homepage.search_editions')"
      @click="ouvrir"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Recherche rapide d'une édition par son nom, depuis l'en-tête de l'accueil.
 *
 * ## Pourquoi, alors que le panneau latéral a déjà un champ « Rechercher par nom »
 *
 * Parce que ce champ-là est **combiné** aux autres filtres, et que l'accueil démarre en masquant
 * les éditions terminées (`showPast: false` dans `pages/index.vue`). Chercher « Rennes 2023 » n'y
 * donne donc jamais rien, et la seule façon de retrouver une édition passée est de deviner qu'il
 * faut d'abord cocher une case de période.
 *
 * Ce composant fait l'inverse, et c'est tout son propos : il **écrase les autres filtres** et
 * **ouvre les trois périodes**. Une édition terminée ou annulée ressort comme les autres. Les
 * éditions hors ligne, elles, restent invisibles : la route publique ne les rend à personne, et
 * ce n'est pas à un champ de recherche d'en décider (cf. `server/utils/visibilite-edition.ts`).
 *
 * ## Comment il parle à la page
 *
 * Par l'URL, et rien d'autre. `pages/index.vue` observe déjà la query de la route et réinitialise
 * ses filtres à chaque changement : écrire la query suffit à recharger la liste, sans état partagé
 * entre l'en-tête et la page. Bénéfice secondaire : la recherche se relit dans l'URL, donc elle se
 * partage, et le bouton « précédent » du navigateur la défait.
 *
 * ⚠️ La query écrite ici doit être **exactement** celle que le `updateUrlFromFilters` de la page
 * réécrirait à partir des mêmes filtres — d'où `showPast` seul, sans `showCurrent` ni `showFuture`
 * qui valent déjà vrai par défaut et que la page omet donc de l'URL. Deux écritures qui divergent
 * feraient une entrée d'historique par caractère tapé, la page repoussant aussitôt sa version.
 *
 * ## Pourquoi l'état d'ouverture sort d'ici
 *
 * Le champ déployé doit prendre **tout l'en-tête** et masquer le reste — logo, langue, messagerie,
 * notifications, compte. Ces éléments appartiennent à `AppHeader`, pas à ce composant : l'état
 * remonte donc par `v-model:open`, et c'est `AppHeader` qui efface ses propres enfants.
 */

/** Le champ est-il déployé ? Piloté par `AppHeader`, qui masque le reste de l'en-tête pendant ce temps. */
const ouvert = defineModel<boolean>('open', { default: false })

const route = useRoute()
const router = useRouter()

// `strategy: 'no_prefix'` (nuxt.config) : l'accueil est toujours `/`, quelle que soit la langue.
const surAccueil = computed(() => route.path === '/')

const terme = ref('')

/**
 * A-t-on déjà écrasé les filtres de la page ?
 *
 * Sert à ne rien réinitialiser quand on ouvre puis referme la loupe sans avoir rien tapé :
 * l'utilisateur avait peut-être posé des filtres, et ouvrir un champ ne doit pas changer la liste.
 */
const aEcraseLesFiltres = ref(false)

/** Écrit la recherche dans l'URL. Un nom vide rend à l'accueil ses filtres par défaut. */
const appliquer = (nom: string) => {
  const query: Record<string, string> = {}

  // La vue (grille, agenda, carte) survit à la recherche : celle-ci change ce qu'on liste, pas la
  // façon de le regarder.
  if (typeof route.query.view === 'string') query.view = route.query.view

  if (nom) {
    query.name = nom
    query.showPast = 'true'
    // La plus récente d'abord. L'ordre par défaut de l'accueil — la plus proche en premier — sert
    // à parcourir ce qui vient ; dès que le passé s'ouvre, il remonterait en tête l'édition la
    // plus ancienne, c'est-à-dire la moins probable de celles qu'on cherche.
    query.sort = 'recent'
  }

  // `replace` et non `push` : une frappe n'est pas une étape de navigation, et pousser laisserait
  // une entrée d'historique par caractère.
  router.replace({ query })
}

const rechercher = (valeur: string | number) => {
  terme.value = String(valeur)
  const nom = terme.value.trim()
  if (nom) aEcraseLesFiltres.value = true
  appliquer(nom)
}

const ouvrir = () => {
  // Reprendre le nom déjà filtré s'il y en a un : le champ doit montrer ce que la liste applique,
  // plutôt que de paraître vide au-dessus de résultats filtrés.
  terme.value = typeof route.query.name === 'string' ? route.query.name : ''
  ouvert.value = true
}

/** Replie le champ sans toucher à l'URL. */
const replier = () => {
  ouvert.value = false
  terme.value = ''
  aEcraseLesFiltres.value = false
}

const fermer = () => {
  const aFiltre = aEcraseLesFiltres.value
  replier()
  // Refermer la loupe rend l'accueil tel qu'on l'y trouve d'ordinaire. Laisser le filtre en place
  // derrière un champ qu'on vient de masquer donnerait une liste amputée sans cause visible — et
  // sur mobile, où le panneau de filtres vit dans une modale, la cause serait introuvable.
  if (aFiltre) appliquer('')
}

// Quitter l'accueil replie la loupe. Sans cela, le composant cesse de s'afficher alors que son
// modèle reste à « ouvert » : `AppHeader` continuerait de masquer logo, langue et compte sur toutes
// les pages suivantes, et rien à l'écran n'en donnerait la raison.
watch(surAccueil, (sur) => {
  if (!sur) replier()
})
</script>
